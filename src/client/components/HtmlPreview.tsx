import React, { useEffect, useRef, useState } from 'react';
import './HtmlPreview.css';

interface Props {
  html: string;
}

export default function HtmlPreview({ html }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Extract styles from <head> and content from <body> if present
  const extractStyles = (htmlContent: string): string => {
    const styleMatches = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    return styleMatches ? styleMatches.join('\n') : '';
  };

  const extractBody = (htmlContent: string): string => {
    if (htmlContent.includes('<body')) {
      return htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || htmlContent;
    }
    return htmlContent;
  };

  const generatedStyles = extractStyles(html);
  const bodyContent = extractBody(html);

  // Inject resize script into HTML
  const htmlWithResize = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        </style>
        ${generatedStyles}
      </head>
      <body>
        ${bodyContent}
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

  // Close fullscreen on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  return (
    <>
      <div className="html-preview">
        <div className="preview-header">
          <span>Interactive Preview</span>
          <button
            className="fullscreen-btn"
            onClick={() => setIsFullscreen(true)}
            title="Open fullscreen"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
        <iframe
          ref={iframeRef}
          srcDoc={htmlWithResize}
          sandbox="allow-scripts"
          style={{ height: `${height}px` }}
          title="Generated UI Preview"
        />
      </div>

      {isFullscreen && (
        <div className="fullscreen-modal" onClick={() => setIsFullscreen(false)}>
          <div className="fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <div className="fullscreen-header">
              <span>Interactive Preview</span>
              <button
                className="close-btn"
                onClick={() => setIsFullscreen(false)}
                title="Close (Esc)"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <iframe
              srcDoc={htmlWithResize}
              sandbox="allow-scripts"
              title="Generated UI Preview (Fullscreen)"
            />
          </div>
        </div>
      )}
    </>
  );
}
