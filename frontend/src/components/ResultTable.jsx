import React from 'react';
import { motion } from 'framer-motion';
import { RiGridLine, RiDownloadLine, RiNumbersLine } from 'react-icons/ri';

const ResultTable = ({ queryResult }) => {
  const { columns = [], rows = [] } = queryResult;

  if (columns.length === 0 || rows.length === 0) {
    return null;
  }

  const handleExportCSV = () => {
    // Basic CSV exporter
    const csvContent = "data:text/csv;charset=utf-8," 
      + [columns.join(","), ...rows.map(row => columns.map(col => `"${row[col]}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `querybridge_result_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.6 }}
      className="w-full max-w-3xl mx-auto mt-8 glass-panel-purple rounded-2xl p-6 border border-neon-purple/20 shadow-[0_0_30px_rgba(171,0,255,0.05)]"
    >
      {/* Table Title and Stats */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
        <div className="flex items-center gap-2">
          <RiGridLine className="text-xl text-neon-purple" />
          <div>
            <h4 className="font-display font-bold text-sm text-white tracking-wide uppercase">
              Relational Output Buffer
            </h4>
            <p className="text-[10px] font-mono text-white/40 mt-0.5">
              TABLE: <span className="text-neon-purple">DYNAMIC_RESULT_SET</span>
            </p>
          </div>
        </div>

        {/* Buttons / Actions */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 rounded-md px-2.5 py-1.5 text-[10px] font-mono text-white/50">
            <RiNumbersLine className="text-neon-purple" />
            <span>ROWS: <strong className="text-white">{rows.length}</strong></span>
          </div>
          
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-neon-purple/20 border border-white/10 hover:border-neon-purple/50 text-[10px] font-mono text-white/80 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <RiDownloadLine className="text-xs" />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table Wrapper */}
      <div className="w-full overflow-x-auto rounded-xl border border-white/10 bg-black/20">
        <table className="w-full border-collapse text-left text-xs font-sans">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              {columns.map((column, index) => (
                <th
                  key={index}
                  className="px-5 py-4 font-mono font-bold text-[10px] text-white/60 uppercase tracking-widest border-r border-white/5 last:border-0"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody className="divide-y divide-white/5">
            {rows.map((row, rowIndex) => (
              <motion.tr
                key={rowIndex}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: rowIndex * 0.05, duration: 0.4 }}
                className="hover:bg-neon-purple/5 transition-all duration-250"
              >
                {columns.map((column, colIndex) => {
                  const val = row[column];
                  const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
                  
                  return (
                    <td
                      key={colIndex}
                      className="px-5 py-3.5 text-white/80 font-mono tracking-wide border-r border-white/5 last:border-0"
                    >
                      {/* Highlight specific values like status or IDs */}
                      {column.toLowerCase().includes('status') ? (
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          valStr === 'processing' 
                            ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/25'
                            : 'bg-green-500/10 text-green-500 border border-green-500/25'
                        }`}>
                          {valStr}
                        </span>
                      ) : column.toLowerCase().includes('email') ? (
                        <span className="text-neon-cyan/80">{valStr}</span>
                      ) : (
                        valStr
                      )}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default ResultTable;
