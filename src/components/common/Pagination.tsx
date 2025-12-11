import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    pageSizeOptions?: number[];
}

export default function Pagination({
    currentPage,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [25, 50, 100]
}: PaginationProps) {
    const totalPages = Math.ceil(totalItems / pageSize);
    const startItem = currentPage * pageSize + 1;
    const endItem = Math.min((currentPage + 1) * pageSize, totalItems);

    if (totalItems === 0) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-slate-900/50 border-t border-slate-700 rounded-b-lg">
            <div className="flex items-center text-sm text-slate-400">
                <span>
                    Showing <span className="font-medium text-white">{startItem}</span> to{' '}
                    <span className="font-medium text-white">{endItem}</span> of{' '}
                    <span className="font-medium text-white">{totalItems}</span> results
                </span>
            </div>

            <div className="flex items-center gap-4">
                <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-2.5 py-1.5 focus:ring-cyan-500 focus:border-cyan-500"
                >
                    {pageSizeOptions.map(option => (
                        <option key={option} value={option}>{option} per page</option>
                    ))}
                </select>

                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                        onClick={() => onPageChange(0)}
                        disabled={currentPage === 0}
                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-700 hover:bg-slate-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="sr-only">First</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 0}
                        className="relative inline-flex items-center px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-700 hover:bg-slate-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="sr-only">Previous</span>
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-slate-700 focus:outline-offset-0">
                        {currentPage + 1} / {totalPages}
                    </span>
                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages - 1}
                        className="relative inline-flex items-center px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-700 hover:bg-slate-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="sr-only">Next</span>
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onPageChange(totalPages - 1)}
                        disabled={currentPage >= totalPages - 1}
                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-700 hover:bg-slate-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="sr-only">Last</span>
                        <ChevronsRight className="h-4 w-4" />
                    </button>
                </nav>
            </div>
        </div>
    );
}
