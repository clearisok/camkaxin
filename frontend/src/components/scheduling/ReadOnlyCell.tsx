interface ReadOnlyCellProps {
  value?: string | number | null;
  multiline?: boolean;
  placeholder?: string;
}

export default function ReadOnlyCell({ value, multiline, placeholder = '—' }: ReadOnlyCellProps) {
  const text = value == null || value === '' ? placeholder : String(value);
  if (multiline) {
    return <span className="scheduling-readonly-cell multiline">{text}</span>;
  }
  return <span className="scheduling-readonly-cell">{text}</span>;
}
