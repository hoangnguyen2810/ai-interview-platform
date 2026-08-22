import re


def clean_response(text: str) -> str:
    """
    Xóa dòng trống thừa, và cắt bỏ phần bị model lặp vòng lặp (degeneration
    loop) — trường hợp model nhỏ lặp lại cùng 1 cụm từ nhiều lần liên tiếp.
    """
    if not text:
        return text

    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = _truncate_repetition_loop(text)

    lines = [line.rstrip() for line in text.split('\n')]

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
    result = re.sub(r'(\n[ \t]*[-*].*)\n[ \t]*\n(?=[ \t]*[-*])', r'\1\n', result)
    result = re.sub(r'(:\s*)\n[ \t]*\n(?=[ \t]*[-*])', r'\1\n', result)
    result = re.sub(r'(\n[ \t]*\d+\..*)\n[ \t]*\n(?=[ \t]*\d+\.)', r'\1\n', result)

    result = _fix_missing_linebreaks(result)

    return result.strip()


def _fix_missing_linebreaks(text: str) -> str:
    """
    Trường hợp model gộp mọi thứ thành 1 dòng dài, không có \\n nào giữa
    các heading dạng **Xxx:** — chèn xuống dòng trước mỗi heading dạng đó
    (trừ heading đầu tiên) để markdown render đúng thành từng khối riêng.
    """
    if text.count('\n') > 2:
        # Đã có đủ line break, không cần vá
        return text

    # Chèn \n\n trước mỗi "**Từ khóa:**" xuất hiện không phải ở đầu chuỗi
    fixed = re.sub(r'(?<!^)(?<!\n)(\*\*[^*\n]{2,30}:\*\*)', r'\n\n\1', text)
    return fixed


def _truncate_repetition_loop(
    text: str,
    phrase_words: int = 3,
    max_repeats: int = 4,
) -> str:
    """
    Phát hiện trường hợp model bị kẹt lặp lại cùng 1 cụm từ (vd: "Tham gia
    dự án: Không đề cập" x30 lần) và cắt bỏ toàn bộ phần lặp, chỉ giữ lại
    nội dung hợp lệ trước đó.

    Cách làm: trượt cửa sổ `phrase_words` từ, nếu cùng 1 cụm xuất hiện liên
    tiếp >= max_repeats lần (cho phép xen khoảng trắng/dấu câu khác nhau
    một chút), cắt văn bản tại điểm bắt đầu lặp.
    """
    words = text.split()
    if len(words) < phrase_words * max_repeats:
        return text

    i = 0
    while i <= len(words) - phrase_words * max_repeats:
        phrase = words[i : i + phrase_words]
        repeat_count = 1
        j = i + phrase_words
        while (
            j + phrase_words <= len(words)
            and words[j : j + phrase_words] == phrase
        ):
            repeat_count += 1
            j += phrase_words

        if repeat_count >= max_repeats:
            # Cắt tại điểm bắt đầu chuỗi lặp, giữ lại phần hợp lệ trước đó.
            truncated_words = words[:i]
            truncated = ' '.join(truncated_words).rstrip()
            # Thêm dấu hiệu nhẹ để biết là bị cắt do lặp (tuỳ chọn, có thể bỏ)
            return truncated

        i += 1

    return text