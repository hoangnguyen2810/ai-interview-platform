import { useState } from "react";
import Editor from "@monaco-editor/react";

export default function CandidateCodingView() {
  const [code, setCode] = useState(`from typing import List

class Solution:
    def twoSum(self, nums: List[int], target: int):
        seen = {}

        for i, num in enumerate(nums):
            diff = target - num

            if diff in seen:
                return [seen[diff], i]

            seen[num] = i`);
  const [language, setLanguage] = useState("python");

  return (
    <div className="w-full h-full flex bg-[#071524] rounded-xl overflow-hidden border border-cyan-500/20">
      {/* LEFT SIDE */}
      <div className="flex-[4] flex flex-col border-r border-cyan-500/10">
        {/* QUESTION */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Problem Description
          </h3>

          <p className="text-white/80 leading-7">
            Given an array of integers nums and an integer target, return
            indices of the two numbers such that they add up to target.
          </p>

          <div className="mt-8">
            <h4 className="text-cyan-400 font-medium mb-2">Example 1</h4>

            <div className="bg-[#122131] border border-cyan-500/10 rounded-lg p-4 text-sm text-white/80">
              <p>Input: nums = [2,7,11,15], target = 9</p>
              <p>Output: [0,1]</p>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="text-cyan-400 font-medium mb-2">Constraints</h4>

            <ul className="space-y-2 text-sm text-white/80">
              <li>• 2 ≤ nums.length ≤ 10⁴</li>
              <li>• -10⁹ ≤ nums[i] ≤ 10⁹</li>
              <li>• Exactly one valid answer exists.</li>
            </ul>
          </div>
        </div>

        {/* OUTPUT */}
        <div className="h-56 border-t border-cyan-500/10 bg-[#0d1c2d]">
          <div className="flex items-center justify-between px-4 border-b border-cyan-500/10">
            {/* LEFT */}
            <div className="flex items-center">
              <button className="px-4 py-3 text-cyan-400 border-b-2 border-cyan-400">
                Testcase
              </button>

              <button className="px-4 py-3 text-white/50 hover:text-cyan-300 transition-colors">
                Test Result
              </button>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-3">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-[#122131] border border-cyan-500/10 text-white px-3 py-1.5 rounded-lg text-sm"
              >
                <option value="python">Python3</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="javascript">JavaScript</option>
              </select>

              <button
                onClick={() => {
                  console.log(code);
                }}
                className="px-4 py-1.5 rounded-lg bg-[#16304b]"
              >
                Run
              </button>

              <button className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#051424] font-semibold text-sm transition-colors">
                Submit
              </button>
            </div>
          </div>

          <div className="p-4">
            <textarea
              className="w-full h-32 bg-[#122131] border border-cyan-500/10 focus:border-cyan-400 rounded-lg p-3 text-white resize-none outline-none"
              defaultValue={`[2,7,11,15]
9`}
            />
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex-[5] flex flex flex-col">
        {/* EDITOR HEADER */}
        <div className="h-11 flex items-center justify-between px-4 border-b border-cyan-500/10 bg-[#122131]">
          <span className="text-sm text-white/70">solution.py</span>

          <div className="flex items-center gap-3 text-white/50">
            <button className="hover:text-cyan-400 transition-colors">⚙</button>

            <button className="hover:text-cyan-400 transition-colors">⛶</button>
          </div>
        </div>

        {/* EDITOR */}
        {/* EDITOR */}
        <div className="flex-1 bg-[#0d1c2d]">
          <Editor
            language={language}
            height="100%"
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value || "")}
            options={{
              minimap: {
                enabled: false,
              },
              fontSize: 15,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              tabSize: 4,
              wordWrap: "on",
              padding: {
                top: 16,
              },
              lineNumbers: "on",
            }}
          />
        </div>
      </div>
    </div>
  );
}
