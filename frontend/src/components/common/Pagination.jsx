import './Pagination.css';

const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, pageSize }) => {
    if (totalPages <= 1) return null;

    const getPages = () => {
        const pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (currentPage < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalItems);

    return (
        <div>
            <div className="pagination">
                <button
                    className="pagination__btn"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    ← Prev
                </button>

                {getPages().map((p, i) =>
                    p === '...' ? (
                        <span key={`ellipsis-${i}`} className="pagination__ellipsis">…</span>
                    ) : (
                        <button
                            key={p}
                            className={`pagination__btn ${p === currentPage ? 'pagination__btn--active' : ''}`}
                            onClick={() => onPageChange(p)}
                        >
                            {p}
                        </button>
                    )
                )}

                <button
                    className="pagination__btn"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                >
                    Next →
                </button>
            </div>
            {totalItems > 0 && (
                <p className="pagination__info">
                    Showing {from}–{to} of {totalItems} records
                </p>
            )}
        </div>
    );
};

export default Pagination;
