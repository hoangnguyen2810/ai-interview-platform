export default function CodeEditor() {
  return (
    <div className="w-full lg:w-[70%] flex flex-col rounded-lg overflow-hidden border border-white/10 bg-[#0d1c2d]/80 backdrop-blur-md">
      {/* HEADER */}
      <div className="flex items-center justify-between bg-white/5 px-4 py-3 border-b border-white/10">
        <div className="flex items-center space-x-4">
          <div className="px-4 py-2">
            <div className="flex items-center gap-4 text-[10px] text-white/30 uppercase tracking-widest">
              <span>Python 3.10</span>
              <span>UTF-8</span>

              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Connected
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-grow flex font-mono text-sm p-6 overflow-auto bg-[#051424]/50">
        <div className="text-white/20 text-right pr-6 select-none border-r border-white/5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        <div className="pl-6 w-full">
          <div className="text-cyan-400">def</div>

          <div>find_optimal_path(grid):</div>

          <div className="pl-4 text-white/40">
            """Neural Syntax Optimization Engine"""
          </div>

          <div className="pl-4">
            <span className="text-cyan-400">if not</span> grid:
          </div>

          <div className="pl-8 text-cyan-400">return</div>

          <div>[]</div>

          <div className="pl-4">rows, cols = len(grid), len(grid[0])</div>

          <div className="pl-4">
            dp = [[0] * cols <span className="text-cyan-400">for</span> _{" "}
            <span className="text-cyan-400">in</span> range(rows)]
          </div>

          <div className="pl-4 text-white/40">
            # TODO: Implement Dijkstra's with AI weights
          </div>

          <div className="pl-4">dp[0][0] = grid[0][0]</div>

          <div className="pl-4">
            <span className="text-cyan-400">for</span> i{" "}
            <span className="text-cyan-400">in</span> range(1, rows):
          </div>

          <div className="pl-8">dp[i][0] = dp[i-1][0] + grid[i][0]</div>

          <div className="pl-4">...</div>

          <div className="animate-pulse w-2 h-5 bg-cyan-400 inline-block ml-1" />
        </div>
      </div>

      {/* STATUS BAR */}
      <div className="px-4 py-2 bg-white/5 border-t border-white/5 text-[10px] text-white/30">
        Ln 12, Col 4
      </div>
    </div>
  );
}
