export default function RecruiterCodingView() {
  return (
    <div className="w-full h-full flex flex-col bg-[#071524] rounded-xl overflow-hidden border border-cyan-500/20">
      {/* HEADER */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-cyan-500/10 bg-[#122131]">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-medium">Live Coding</h3>

          <span className="px-2 py-0.5 text-xs rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Python3
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-green-400 animate-pulse">
            ● Typing...
          </span>

          <span className="px-2 py-0.5 text-xs rounded-md bg-white/5 text-white/60 border border-white/10">
            Read Only
          </span>
        </div>
      </div>

      {/* CODE */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-[#0d1c2d] p-6 font-mono text-sm">
        <pre className="text-white/90 leading-7 whitespace-pre-wrap">
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

      {/* OUTPUT PANEL */}
      <div className="h-44 border-t border-cyan-500/10 bg-[#122131]">
        {/* Tabs */}
        <div className="flex items-center border-b border-cyan-500/10">
          <button className="px-4 py-3 text-cyan-400 border-b-2 border-cyan-400 text-sm">
            Output
          </button>

          <button className="px-4 py-3 text-white/50 hover:text-cyan-300 text-sm transition-colors">
            History
          </button>
        </div>

        {/* Content */}
        <div className="p-4 text-sm">
          <div className="flex items-center gap-2 text-green-400 mb-3">
            ✓ Accepted
          </div>

          <div className="space-y-2 text-white/70">
            <div>Runtime: 32 ms</div>
            <div>Memory: 14.2 MB</div>
            <div>Passed: 12 / 12 test cases</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="h-10 flex items-center justify-between px-4 border-t border-cyan-500/10 bg-[#0f1f30] text-xs text-white/50">
        <span>solution.py</span>

        <div className="flex items-center gap-4">
          <span>Candidate Cursor: Line 14</span>
          <span>Last action: Run Code • 15s ago</span>
        </div>
      </div>
    </div>
  );
}
