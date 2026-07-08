import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

export default function Forbidden() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gray-50 text-center">
      <ShieldAlert className="h-10 w-10 text-red-500" />
      <h1 className="text-xl font-bold text-gray-900">You don't have access to this page</h1>
      <p className="max-w-sm text-sm text-gray-500">
        Your role doesn't have permission to view this section. If you think this is a mistake, contact your hotel
        administrator.
      </p>
      <Link to="/" className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Back to home
      </Link>
    </div>
  );
}
