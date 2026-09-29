import { SignUp } from "@clerk/nextjs";

export default function PaginaRegistrazione() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <SignUp />
    </div>
  );
}
