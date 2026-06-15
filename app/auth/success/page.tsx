"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function AuthSuccess() {
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("token");

    if (!token) return;

    // save auth
    localStorage.setItem("token", token);

    // decode role (optional)
    const payload = JSON.parse(atob(token.split(".")[1]));
    const role = payload.role;

    if (role === "CANDIDATE") {
      window.location.href = "/candidate/dashboard";
    } else if (role === "RECRUITER") {
      window.location.href = "/recruiter/dashboard";
    } else {
      window.location.href = "/";
    }
  }, []);

  return (
    <div className="text-white flex items-center justify-center h-screen">
      Logging in...
    </div>
  );
}
