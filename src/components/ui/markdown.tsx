import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

/** Safe markdown renderer (sanitized — no raw HTML injection). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-niat text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary underline" />,
          code: ({ node, ...props }) => <code {...props} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" />,
          ul: ({ node, ...props }) => <ul {...props} className="my-2 list-disc pl-5" />,
          ol: ({ node, ...props }) => <ol {...props} className="my-2 list-decimal pl-5" />,
          p: ({ node, ...props }) => <p {...props} className="my-1.5" />,
          h1: ({ node, ...props }) => <h1 {...props} className="mt-3 mb-1 text-lg font-bold" />,
          h2: ({ node, ...props }) => <h2 {...props} className="mt-3 mb-1 text-base font-bold" />,
          blockquote: ({ node, ...props }) => <blockquote {...props} className="border-l-2 border-border pl-3 text-fg-muted" />
        }}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
