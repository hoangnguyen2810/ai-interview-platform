-- Insert sample coding questions for testing
-- Run after migration 003

INSERT INTO coding_questions (id, title, description, difficulty, created_by) VALUES
  ('11111111-1111-1111-1111-111111111111',
   'Two Sum',
   'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.',
   'EASY',
   NULL),

  ('22222222-2222-2222-2222-222222222222',
   'Valid Parentheses',
   'Given a string s containing just the characters ''('', ''){'', '']'', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.',
   'EASY',
   NULL),

  ('33333333-3333-3333-3333-333333333333',
   'Merge Two Sorted Lists',
   'You are given the heads of two sorted linked lists list1 and list2.

Merge the two lists into one sorted linked list. The list should be made by splicing together the nodes of the first two lists.

Return the head of the merged linked list.',
   'MEDIUM',
   NULL),

  ('44444444-4444-4444-4444-444444444444',
   'Longest Substring Without Repeating Characters',
   'Given a string s, find the length of the longest substring without repeating characters.

A substring is a contiguous non-empty sequence of characters within a string.',
   'MEDIUM',
   NULL),

  ('55555555-5555-5555-5555-555555555555',
   'Binary Tree Maximum Path Sum',
   'A path in a binary tree is a sequence of nodes where each pair of adjacent nodes in the sequence has an edge connecting them. A node can only appear in the sequence at most once. Note that the path does not need to pass through the root.

The path sum of a path is the sum of the node''s values in the path.

Given the root of a binary tree, return the maximum path sum of any non-empty path.',
   'HARD',
   NULL),

  ('66666666-6666-6666-6666-666666666666',
   'LRU Cache',
   'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.

Implement the LRUCache class:
- LRUCache(int capacity) Initialize the LRU cache with positive size capacity.
- int get(int key) Return the value of the key if it exists, otherwise return -1.
- void put(int key, int value) Update the value of the key if the key exists. Otherwise, add the key-value pair to the cache. If the number of keys exceeds the capacity, evict the least recently used key.

The functions get and put must each run in O(1) average time complexity.',
   'HARD',
   NULL);
