import { ButtonHTMLAttributes } from "react";
export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return <button className={`button ${variant} ${className}`} {...props} />;
}
