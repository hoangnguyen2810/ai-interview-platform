"use client";

import { CandidateSideNavBar } from "@/app/components/CandidateSideNavBar";
import { TopNavBar } from "@/app/components/TopNavBar";
import { Search, BookOpen, ArrowRight } from "lucide-react";
import { Pagination } from "@/app/components/Pagination";
import { useState } from "react";

const categories = [
  "Tất cả",
  "Frontend",
  "Backend",
  "Database",
  "DSA",
  "System Design",
  "DevOps",
  "AI",
];

const articles = [
  {
    title: "HTML Fundamentals",
    category: "Frontend",
    level: "Cơ bản",
    time: "6 phút đọc",
    description: "Tìm hiểu cấu trúc trang web, thẻ HTML và semantic HTML.",
  },
  {
    title: "CSS Flexbox & Grid",
    category: "Frontend",
    level: "Cơ bản",
    time: "9 phút đọc",
    description: "Xây dựng layout hiện đại với Flexbox và CSS Grid.",
  },
  {
    title: "JavaScript ES6+",
    category: "Frontend",
    level: "Trung bình",
    time: "15 phút đọc",
    description: "Arrow Function, Destructuring, Spread Operator và Module.",
  },
  {
    title: "React Hooks",
    category: "Frontend",
    level: "Cơ bản",
    time: "10 phút đọc",
    description: "Tìm hiểu useState, useEffect, useRef và các Hook phổ biến.",
  },
  {
    title: "Next.js App Router",
    category: "Frontend",
    level: "Trung bình",
    time: "14 phút đọc",
    description:
      "Tìm hiểu App Router, Layout, Server Component và Client Component.",
  },
  {
    title: "JWT Authentication",
    category: "Backend",
    level: "Trung bình",
    time: "12 phút đọc",
    description: "Cơ chế xác thực người dùng bằng JSON Web Token.",
  },
  {
    title: "RESTful API Design",
    category: "Backend",
    level: "Trung bình",
    time: "11 phút đọc",
    description: "Các nguyên tắc thiết kế API chuẩn REST.",
  },
  {
    title: "Node.js Event Loop",
    category: "Backend",
    level: "Nâng cao",
    time: "13 phút đọc",
    description: "Hiểu cơ chế bất đồng bộ và Event Loop trong Node.js.",
  },
  {
    title: "WebSocket & Real-time",
    category: "Backend",
    level: "Nâng cao",
    time: "15 phút đọc",
    description: "Xây dựng ứng dụng thời gian thực với WebSocket.",
  },
  {
    title: "SQL Basics",
    category: "Database",
    level: "Cơ bản",
    time: "8 phút đọc",
    description: "SELECT, INSERT, UPDATE, DELETE và các truy vấn cơ bản.",
  },
  {
    title: "PostgreSQL Index",
    category: "Database",
    level: "Trung bình",
    time: "10 phút đọc",
    description: "Tìm hiểu Index và tối ưu hiệu năng truy vấn.",
  },
  {
    title: "Database Normalization",
    category: "Database",
    level: "Trung bình",
    time: "9 phút đọc",
    description: "Chuẩn hóa dữ liệu từ 1NF đến 3NF.",
  },
  {
    title: "Binary Search",
    category: "DSA",
    level: "Cơ bản",
    time: "8 phút đọc",
    description: "Thuật toán tìm kiếm nhị phân và cách áp dụng.",
  },
  {
    title: "Hash Table",
    category: "DSA",
    level: "Trung bình",
    time: "10 phút đọc",
    description: "Cấu trúc dữ liệu Hash Table và các trường hợp sử dụng.",
  },
  {
    title: "DFS & BFS",
    category: "DSA",
    level: "Trung bình",
    time: "12 phút đọc",
    description: "Duyệt đồ thị theo chiều sâu và chiều rộng.",
  },
  {
    title: "Dynamic Programming",
    category: "DSA",
    level: "Nâng cao",
    time: "18 phút đọc",
    description: "Kỹ thuật tối ưu hóa bài toán bằng quy hoạch động.",
  },
  {
    title: "System Design Basics",
    category: "System Design",
    level: "Trung bình",
    time: "15 phút đọc",
    description: "Các thành phần cơ bản trong hệ thống quy mô lớn.",
  },
  {
    title: "Load Balancer",
    category: "System Design",
    level: "Nâng cao",
    time: "12 phút đọc",
    description: "Phân phối tải và tăng khả năng chịu lỗi cho hệ thống.",
  },
  {
    title: "Docker Fundamentals",
    category: "DevOps",
    level: "Cơ bản",
    time: "11 phút đọc",
    description: "Khái niệm Container, Image và Docker Compose.",
  },
  {
    title: "CI/CD Pipeline",
    category: "DevOps",
    level: "Trung bình",
    time: "14 phút đọc",
    description: "Tự động hóa quy trình build, test và deploy.",
  },
  {
    title: "Introduction to LLM",
    category: "AI",
    level: "Cơ bản",
    time: "10 phút đọc",
    description: "Tổng quan về Large Language Models và ứng dụng.",
  },
  {
    title: "Prompt Engineering",
    category: "AI",
    level: "Trung bình",
    time: "9 phút đọc",
    description: "Kỹ thuật viết prompt hiệu quả cho mô hình AI.",
  },
  {
    title: "Retrieval Augmented Generation (RAG)",
    category: "AI",
    level: "Nâng cao",
    time: "16 phút đọc",
    description: "Kết hợp truy xuất dữ liệu và LLM để tăng độ chính xác.",
  },
];

export default function KnowledgePage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const filteredArticles = articles.filter((article) => {
    const matchCategory =
      selectedCategory === "Tất cả" || article.category === selectedCategory;

    const keyword = search.toLowerCase();

    const matchSearch =
      article.title.toLowerCase().includes(keyword) ||
      article.description.toLowerCase().includes(keyword);

    return matchCategory && matchSearch;
  });
  const ITEMS_PER_PAGE = 5;

  const [page, setPage] = useState(1);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredArticles.length / ITEMS_PER_PAGE),
  );

  const safePage = Math.min(Math.max(page, 1), totalPages);

  const currentArticles = filteredArticles.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  const goToPage = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="flex min-h-screen bg-[#051424] text-[#d4e4fa]">
      {/* Sidebar */}
      <CandidateSideNavBar />

      {/* Main */}
      <div className="flex flex-col flex-1 min-h-screen">
        {/* Top Navbar */}
        <TopNavBar />

        {/* Content */}
        <main className="pt-16 ml-[280px] h-screen overflow-y-auto custom-scrollbar p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold text-cyan-400">
                Kho kiến thức
              </h1>

              <p className="text-gray-400 mt-3">
                Học tập • Tra cứu • Chuẩn bị phỏng vấn CNTT
              </p>
            </div>

            {/* Search */}
            <div className="relative mb-8">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm kiếm bài viết..."
                className="w-full rounded-xl border border-slate-700 bg-[#0d1c2d] py-3 pl-12 pr-4 outline-none focus:border-cyan-500"
              />
            </div>

            {/* Categories */}
            <div className="flex flex-wrap gap-3 mb-10">
              {categories.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setSelectedCategory(item);
                    setPage(1);
                  }}
                  className={`rounded-full border px-5 py-2 text-sm transition cursor-pointer
      ${
        selectedCategory === item
          ? "border-cyan-400 bg-cyan-500/20 text-cyan-300"
          : "border-slate-700 bg-[#0d1c2d] hover:border-cyan-400 hover:bg-cyan-500/10 cursor-pointer"
      }`}
                >
                  {item}
                </button>
              ))}
            </div>

            {/* Title */}
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="text-cyan-400" />
              <h2 className="text-2xl font-bold">Danh sách bài viết</h2>
            </div>

            {/* Cards */}
            <div className="space-y-6">
              {currentArticles.map((article) => (
                <div
                  key={article.title}
                  className="rounded-2xl border border-slate-700 bg-[#0d1c2d] p-6 transition hover:border-cyan-500 hover:shadow-lg hover:shadow-cyan-500/10"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-3">
                      <h3 className="text-2xl font-semibold text-cyan-300">
                        {article.title}
                      </h3>

                      <div className="text-sm text-gray-400">
                        {article.category}
                        <span className="mx-2"> </span>
                        {article.level}
                        <span className="mx-2"> </span>
                        {article.time}
                      </div>

                      <p className="text-gray-300">{article.description}</p>
                    </div>

                    <button className="flex items-center gap-2 rounded-lg bg-cyan-500/10 px-4 py-2 text-cyan-300 hover:bg-cyan-500/20 cursor-pointer">
                      Xem chi tiết
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        </main>
      </div>
    </div>
  );
}
