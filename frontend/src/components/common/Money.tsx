interface MoneyProps {
  /** The amount, always denominated in Indian Rupees (INR). */
  amount: number;
  className?: string;
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/**
 * Renders a money amount formatted as Indian Rupees (₹). NovaStay HMS
 * operates exclusively in INR — there is no currency conversion or
 * per-user display currency.
 */
export function Money({ amount, className }: MoneyProps) {
  return <span className={className}>{inrFormatter.format(amount)}</span>;
}
