import React, { useEffect, useRef, useState } from 'react';
import './HtmlPreview.css';

interface Props {
  html: string;
}

export default function HtmlPreview({ html }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  // Inject resize script into HTML
  const htmlWithResize = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        </style>
      </head>
      <body>
        ${html.includes('<body') ? html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html : html}
        <script>
          function sendHeight() {
            const height = Math.max(
              document.body.scrollHeight,
              document.documentElement.scrollHeight
            );
            window.parent.postMessage({ type: 'resize', height: height + 32 }, '*');
          }

          window.addEventListener('load', sendHeight);
          window.addEventListener('resize', sendHeight);

          new MutationObserver(sendHeight).observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
          });

          setTimeout(sendHeight, 100);
        <\/script>
      </body>
    </html>
  `;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'resize' && typeof event.data.height === 'number') {
        setHeight(Math.min(event.data.height, 600));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="html-preview">
      <div className="preview-header">
        <span>Interactive Preview</span>
      </div>
      <iframe
        ref={iframeRef}
        srcDoc={htmlWithResize}
        sandbox="allow-scripts"
        style={{ height: `${height}px` }}
        title="Generated UI Preview"
      />
    </div>
  );
}
