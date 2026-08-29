def two_sum(nums, target):
    seen = {}

    for i, num in enumerate(nums):
        complement = target - num

        if complement in seen:
            return [seen[complement], i]

        seen[num] = i

    return []


# Nhập từ bàn phím
nums = list(map(int, input("Nhập mảng nums: ").split()))
target = int(input("Nhập target: "))

result = two_sum(nums, target)

print("Kết quả:", result)