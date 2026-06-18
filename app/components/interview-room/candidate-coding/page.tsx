export default function CandidateCodingView() {
  return (
    <div className="w-full h-full flex flex-col bg-[#1a1a1a] rounded-xl overflow-hidden border border-[#3c3c3c]">
      {/* MAIN */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL */}
        <div className="w-1/2 border-r border-[#3c3c3c] overflow-y-auto p-6">
          <h3 className="text-white text-lg font-semibold mb-4">
            Problem Description
          </h3>

          <p className="text-white/80 leading-7">
            Given an array of integers nums and an integer target, return
            indices of the two numbers such that they add up to target.
          </p>

          <div className="mt-8">
            <h4 className="text-green-500 font-medium mb-2">Example 1</h4>

            <div className="bg-[#262626] rounded-lg p-4 text-white/80 text-sm">
              <p>Input: nums = [2,7,11,15], target = 9</p>
              <p>Output: [0,1]</p>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="text-green-500 font-medium mb-2">Constraints</h4>

            <ul className="space-y-2 text-white/80 text-sm">
              <li>• 2 ≤ nums.length ≤ 10⁴</li>
              <li>• -10⁹ ≤ nums[i] ≤ 10⁹</li>
              <li>• Exactly one valid answer exists.</li>
            </ul>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-1/2 flex flex-col">
          {/* EDITOR HEADER */}
          <div className="h-11 flex items-center justify-between px-4 border-b border-[#3c3c3c] bg-[#262626]">
            <span className="text-white/70 text-sm">solution.py</span>

            <div className="flex items-center gap-3 text-white/50">
              <button>⚙</button>
              <button>⛶</button>
            </div>
          </div>

          {/* EDITOR */}
          <div className="flex-1 bg-[#1e1e1e] p-6 font-mono text-sm overflow-auto">
            <pre className="text-white/90 leading-7">
              {`from typing import List

class Solution:
    def twoSum(self, nums: List[int], target: int):
        seen = {}

        for i, num in enumerate(nums):
            diff = target - num

            if diff in seen:
                return [seen[diff], i]

            seen[num] = i`}
            </pre>
          </div>
        </div>
      </div>

      {/* BOTTOM PANEL */}
      <div className="h-56 border-t border-[#3c3c3c] bg-[#282828]">
        <div className="flex items-center justify-between border-b border-[#3c3c3c] px-4">
          {/* LEFT */}
          <div className="flex items-center">
            <button className="px-4 py-3 text-white border-b-2 border-[#ffa116]">
              Testcase
            </button>

            <button className="px-4 py-3 text-white/50 hover:text-white">
              Test Result
            </button>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            <select className="bg-[#1f1f1f] border border-[#3c3c3c] text-white px-3 py-1.5 rounded text-sm">
              <option>Python3</option>
              <option>Java</option>
              <option>C++</option>
              <option>JavaScript</option>
            </select>

            <button className="px-4 py-1.5 rounded bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white text-sm">
              Run
            </button>

            <button className="px-4 py-1.5 rounded bg-[#ffa116] hover:bg-[#ffb84d] text-black font-medium text-sm">
              Submit
            </button>
          </div>
        </div>

        <div className="p-4">
          <textarea
            className="w-full h-32 bg-[#1a1a1a] border border-[#3c3c3c] rounded p-3 text-white resize-none outline-none"
            defaultValue={`[2,7,11,15]
9`}
          />
        </div>
      </div>
    </div>
  );
}
