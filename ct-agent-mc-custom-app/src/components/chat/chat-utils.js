// Custom markdown parser function
export const parseMarkdown = (text) => {
  // Ensure text is a string
  if (!text || typeof text !== 'string') return '';

  // First, handle the confirmation tag if present
  text = text.replace('#CONFIRMATION_NEEDED', '');

  // Process lists first to handle them properly
  let processedLists = text;
  
  // Process bullet lists (both * and - style)
  const bulletListRegex = /^[\s]*[-*][\s]+(.*?)$/gm;
  const bulletMatches = [...processedLists.matchAll(bulletListRegex)];
  
  if (bulletMatches.length > 0) {
    // Start a list
    processedLists = '<ul>\n';
    
    // Process each list item
    let lastIndex = 0;
    let inList = false;
    
    [...text.matchAll(bulletListRegex)].forEach(match => {
      const [fullMatch, content] = match;
      const startIndex = match.index;
      
      // Add non-list content before this item
      if (startIndex > lastIndex) {
        const nonListContent = text.substring(lastIndex, startIndex);
        if (nonListContent.trim()) {
          processedLists += inList ? '</ul>\n' + nonListContent + '\n<ul>\n' : nonListContent + '\n<ul>\n';
        }
      }
      
      // Add the list item
      processedLists += `<li>${content}</li>\n`;
      lastIndex = startIndex + fullMatch.length;
      inList = true;
    });
    
    // Close the list and add any remaining content
    processedLists += '</ul>\n';
    if (lastIndex < text.length) {
      processedLists += text.substring(lastIndex);
    }
  }

  // Replace headers
  let formattedText = processedLists
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    
    // Bold and italic - process these before line breaks to prevent unwanted breaks
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    
    // Blockquotes
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Handle paragraphs - wrap content in p tags if it's not already in a tag
  // Split by double newlines to create paragraphs
  const paragraphs = formattedText.split(/\n\n+/);
  let processedText = '';
  
  paragraphs.forEach(paragraph => {
    if (paragraph.trim()) {
      // Replace single newlines with spaces within paragraphs
      // This prevents unwanted line breaks within paragraphs
      const processedParagraph = paragraph.replace(/\n/g, ' ');
      
      // Check if the paragraph is already wrapped in HTML tags
      if (!/^<(\w+)[^>]*>.*<\/\1>$/s.test(processedParagraph)) {
        processedText += `<p>${processedParagraph}</p>`;
      } else {
        processedText += processedParagraph;
      }
    }
  });

  return processedText;
};

// Format message content - returns a string with HTML markup
export const formatMessageContent = (content, shouldRenderMarkdown = false) => {
  // Ensure content is a string
  if (!content) return '';
  if (typeof content !== 'string') {
    try {
      return String(content);
    } catch (e) {
      return '';
    }
  }
  
  // If markdown should be rendered, use parseMarkdown
  if (shouldRenderMarkdown) {
    return parseMarkdown(content);
  }
  
  // Otherwise, just return the content as a string
  return content;
}; 