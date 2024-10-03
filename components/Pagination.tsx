import React from "react";

type PaginationProps = {
  totalPages: number;
  page: number;
};


const Pagination: React.FC<PaginationProps> = ({ totalPages, page }) => {
  return <div>pagenation</div>;
};

export default Pagination;
