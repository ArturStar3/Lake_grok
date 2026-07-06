import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './MarkdownContent.css';

const markdownComponents = {
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
};

export default function MarkdownContent({
  children,
  className = '',
  variant = 'default',
  emptyFallback = null,
}) {
  const text = typeof children === 'string' ? children : '';
  const trimmed = text.trim();

  if (!trimmed) {
    return emptyFallback;
  }

  const variantClass =
    variant === 'compact'
      ? 'markdown-content--compact'
      : variant === 'popup'
        ? 'markdown-content--popup'
        : '';

  return (
    <div className={`markdown-content ${variantClass} ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
