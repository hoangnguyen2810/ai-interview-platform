import re


def clean_response(text: str) -> str:
    """
    Xóa dòng trống thừa trong output của model, chỉ giữ tối đa 1 dòng trống
    liên tiếp, và xóa dòng trống xen giữa các dòng bullet / heading / danh
    sách đánh số liền kề.

    Dùng làm lớp bảo hiểm cuối cùng, chạy NGAY SAU khi nhận reply từ model,
    trước khi lưu vào session và trả về cho client.
    """
    if not text:
        return text

    text = text.replace('\r\n', '\n').replace('\r', '\n')
    lines = [line.rstrip() for line in text.split('\n')]

    # Gộp nhiều dòng trống liên tiếp thành tối đa 1 dòng trống
    collapsed = []
    prev_blank = False
    for line in lines:
        is_blank = line.strip() == ''
        if is_blank:
            if prev_blank:
                continue
            prev_blank = True
            collapsed.append('')
        else:
            prev_blank = False
            collapsed.append(line)

    result = '\n'.join(collapsed)

    # Xóa dòng trống giữa 2 dòng bullet liên tiếp (kể cả sub-bullet thụt lề)
    result = re.sub(r'(\n[ \t]*[-*].*)\n[ \t]*\n(?=[ \t]*[-*])', r'\1\n', result)

    # Xóa dòng trống ngay sau heading dạng "Xxx:" nếu dòng kế tiếp là bullet
    result = re.sub(r'(:\s*)\n[ \t]*\n(?=[ \t]*[-*])', r'\1\n', result)

    # Xóa dòng trống giữa 2 dòng đánh số liên tiếp (1. 2. 3. ...)
    result = re.sub(r'(\n[ \t]*\d+\..*)\n[ \t]*\n(?=[ \t]*\d+\.)', r'\1\n', result)

    return result.strip()