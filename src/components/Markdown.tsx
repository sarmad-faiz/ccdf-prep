import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Notes are plain Markdown (no raw HTML: react-markdown escapes it and validation rejects it).
const components: Components = {
  table: ({ children }) => (
    <div className="tbl">
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children }) => (
    <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      {children}
    </a>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
