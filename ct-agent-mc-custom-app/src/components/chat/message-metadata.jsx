import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Collapsible from '@commercetools-uikit/collapsible';
import { AngleUpIcon, AngleDownIcon, ErrorIcon } from '@commercetools-uikit/icons';
import { useIntl } from 'react-intl';
import styles from './message-metadata.module.css';

// Map of tool types to colors and display names
const TOOL_COLORS = {
  // GraphQL tools
  generateGraphQLQuery: { color: '#7A4EFE', name: 'Generate Query' },
  executeGraphQLQuery: { color: '#2C84FC', name: 'Execute Query' },
  
  // Generic tools
  codebase_search: { color: '#2E7D32', name: 'Search' },
  read_file: { color: '#1565C0', name: 'Read' },
  run_terminal_cmd: { color: '#6A1B9A', name: 'Terminal' },
  list_dir: { color: '#EF6C00', name: 'List' },
  grep_search: { color: '#D32F2F', name: 'Grep' },
  edit_file: { color: '#283593', name: 'Edit' },
  file_search: { color: '#00796B', name: 'File' },
  delete_file: { color: '#C62828', name: 'Delete' },
  reapply: { color: '#4527A0', name: 'Reapply' },
  web_search: { color: '#0277BD', name: 'Web' },
  diff_history: { color: '#558B2F', name: 'Diff' },
  default: { color: '#616161', name: 'Tool' }
};

// Tool tag component
const ToolTag = ({ toolName, hasError }) => {
  const toolConfig = TOOL_COLORS[toolName] || TOOL_COLORS.default;
  
  return (
    <span 
      className={`${styles.toolTag} ${hasError ? styles.errorTag : ''}`}
      style={{ 
        backgroundColor: hasError ? '#E53935' : toolConfig.color,
        borderLeft: hasError ? '4px solid #B71C1C' : 'none'
      }}
    >
      {hasError && <ErrorIcon size="small" color="#FFFFFF" />}
      {toolConfig.name}
    </span>
  );
};

ToolTag.propTypes = {
  toolName: PropTypes.string.isRequired,
  hasError: PropTypes.bool,
};

// Helper to get tool name from step, handling different possible structures
const getToolName = (step) => {
  if (!step) return null;
  
  // Direct tool.name property (our expected format)
  if (step.tool && step.tool.name) {
    return step.tool.name;
  }
  
  // Alternative: toolCalls array with toolName property
  if (step.toolCalls && step.toolCalls.length > 0 && step.toolCalls[0].toolName) {
    return step.toolCalls[0].toolName;
  }
  
  // Alternative: direct toolName property
  if (step.toolName) {
    return step.toolName;
  }
  
  // Alternative: type property that might contain the tool name
  if (step.type && step.type !== 'thinking' && step.type !== 'initial') {
    return step.type;
  }
  
  return null;
};

// Helper to extract thinking text from a step, handling different possible structures
const getThinkingText = (step) => {
  if (!step) return null;
  
  // Direct thinking property (our expected format)
  if (step.thinking) {
    return step.thinking;
  }
  
  // Alternative: text property for thinking
  if (step.text && step.stepType === 'initial') {
    return step.text;
  }
  
  // Alternative: thought property
  if (step.thought) {
    return step.thought;
  }
  
  return null;
};

// Helper to extract tool input from a step, handling different possible structures
const getToolInput = (step) => {
  if (!step) return null;
  
  // Direct tool.input property (our expected format)
  if (step.tool && step.tool.input) {
    return step.tool.input;
  }
  
  // Alternative: toolCalls array with args property
  if (step.toolCalls && step.toolCalls.length > 0 && step.toolCalls[0].args) {
    return step.toolCalls[0].args;
  }
  
  // Alternative: args property directly on step
  if (step.args) {
    return step.args;
  }
  
  return null;
};

// Helper to extract tool output from a step, handling different possible structures
const getToolOutput = (step) => {
  if (!step) return null;
  
  // Direct tool.output property (our expected format)
  if (step.tool && step.tool.output) {
    return step.tool.output;
  }
  
  // Alternative: toolResults array with result property
  if (step.toolResults && step.toolResults.length > 0 && step.toolResults[0].result) {
    return step.toolResults[0].result;
  }
  
  // Alternative: result property directly on step
  if (step.result) {
    return step.result;
  }
  
  return null;
};

// Helper to check if tool output has an error
const hasToolError = (step) => {
  const toolOutput = getToolOutput(step);
  const toolName = getToolName(step);
  
  if (!toolOutput) return false;
  
  // Check if the output has error: true
  if (typeof toolOutput === 'object' && toolOutput !== null) {
    // Direct error field check
    if (toolOutput.error === true) {
      return true;
    }
    
    // Special case for GraphQL queries
    if (toolName === 'executeGraphQLQuery') {
      // Check for error property
      if (toolOutput.response?.error === true || 
         (toolOutput.response?.errors && toolOutput.response.errors.length > 0)) {
        return true;
      }
      
      // Check for error message in response string
      if (toolOutput.response?.response && typeof toolOutput.response.response === 'string') {
        const responseStr = toolOutput.response.response;
        if (responseStr.includes('"error": true') || 
            responseStr.includes('GraphQL Error') || 
            responseStr.includes('Error executing GraphQL query')) {
          return true;
        }
      }
    }
    
    // Check for nested error objects
    if (toolOutput.response && toolOutput.response.error === true) {
      return true;
    }
  }
  
  // For string outputs that might be JSON
  if (typeof toolOutput === 'string') {
    // Quick check for error indicators in the string
    if (toolOutput.includes('"error": true') || 
        toolOutput.includes('GraphQL Error') || 
        toolOutput.includes('Error executing GraphQL query')) {
      return true;
    }
    
    try {
      const parsedOutput = JSON.parse(toolOutput);
      
      // Check for direct error field
      if (parsedOutput.error === true) {
        return true;
      }
      
      // Check for GraphQL errors
      if (parsedOutput.response) {
        if (parsedOutput.response.error === true || 
           (parsedOutput.response.errors && parsedOutput.response.errors.length > 0)) {
          return true;
        }
        
        // Check for error message in response string
        if (typeof parsedOutput.response === 'string' && 
           (parsedOutput.response.includes('"error": true') || 
            parsedOutput.response.includes('GraphQL Error') || 
            parsedOutput.response.includes('Error executing GraphQL query'))) {
          return true;
        }
      }
    } catch (e) {
      // Not valid JSON, so we already checked string directly
    }
  }
  
  return false;
};

const MessageMetadata = ({ steps, graphqlQuery }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // Add a state to track which timeline items are expanded
  const [expandedItems, setExpandedItems] = useState({});
  const intl = useIntl();

  if (!steps?.length && !graphqlQuery) return null;

  // Count number of steps and extract unique tool names
  const stepsCount = steps?.length || 0;
  const toolsUsed = new Set();
  
  // Track which tools have errors
  const toolErrors = {};
  
  if (steps?.length) {
    steps.forEach(step => {
      const toolName = getToolName(step);
      if (toolName) {
        toolsUsed.add(toolName);
        
        // Check if this tool execution had an error
        const error = hasToolError(step);
        if (error) {
          toolErrors[toolName] = true;
        }
      }
    });
  }

  const toolsCount = toolsUsed.size;
  const toolsList = Array.from(toolsUsed);

  // Helper to toggle a timeline item's expanded state
  const toggleItemExpanded = (index) => {
    setExpandedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Create a simple footer with tags
  const metadataHeader = (
    <div className={styles.metadataPreview} onClick={toggleExpand}>
      <div className={styles.metadataPreviewRight}>
        <div className={styles.toolTagsContainer}>
          {toolsList.map((tool) => (
            <ToolTag 
              key={tool} 
              toolName={tool} 
              hasError={toolErrors[tool]} 
            />
          ))}
        </div>
        <div className={styles.metadataToggleIcon}>
          {isExpanded ? <AngleUpIcon size="small" /> : <AngleDownIcon size="small" />}
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.metadataContainer}>
      {/* This renders just the footer with tags */}
      {!isExpanded ? (
        metadataHeader
      ) : (
        /* When expanded, show the full content with the timeline */
        <div>
          {metadataHeader}
          <div className={styles.metadataContent}>
            {steps?.length > 0 && (
              <div className={styles.timeline}>
                {steps.map((step, index) => {
                  const thinkingText = getThinkingText(step);
                  const toolName = getToolName(step);
                  const toolInput = getToolInput(step);
                  const toolOutput = getToolOutput(step);
                  const hasError = hasToolError(step);
                  
                  // Skip steps without tool name
                  if (!toolName) return null;
                  
                  // Check if this item is expanded
                  const isItemExpanded = expandedItems[index] || false;
                  
                  // Get the tool color for the border
                  const toolConfig = TOOL_COLORS[toolName] || TOOL_COLORS.default;
                  
                  return (
                    <div key={index} className={styles.timelineItem}>
                      <div className={styles.timelineBadge}>{index + 1}</div>
                      <div className={styles.timelineContent}>
                        <div 
                          className={styles.toolCard}
                          style={{
                            borderLeft: `3px solid ${toolConfig.color}`
                          }}
                        >
                          <div 
                            className={styles.toolCardHeader}
                            onClick={() => toggleItemExpanded(index)}
                          >
                            <div className={styles.toolCardTitle}>
                              <strong>{toolConfig.name}</strong>
                              {hasError && (
                                <span className={styles.errorIndicator}>
                                  <ErrorIcon size="small" color="#FFFFFF" />
                                  Error
                                </span>
                              )}
                            </div>
                            <div className={styles.toolCardIcon}>
                              {isItemExpanded ? 
                                <AngleUpIcon size="small" /> : 
                                <AngleDownIcon size="small" />
                              }
                            </div>
                          </div>
                          
                          {isItemExpanded && (
                            <div className={styles.toolCardContent}>
                              {thinkingText && (
                                <div className={styles.stepText}>
                                  <strong>AI Reasoning:</strong>
                                  <pre>{thinkingText}</pre>
                                </div>
                              )}
                              
                              {toolInput && (
                                <div>
                                  <strong>Input:</strong>
                                  <div className={styles.codeBlock}>
                                    <pre>
                                      <code>{JSON.stringify(toolInput, null, 2)}</code>
                                    </pre>
                                  </div>
                                </div>
                              )}
                              
                              {toolOutput && (
                                <div>
                                  <strong>Output:</strong>
                                  <div className={styles.codeBlock}>
                                    <pre>
                                      <code>{JSON.stringify(toolOutput, null, 2)}</code>
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {graphqlQuery && (
              <div className={styles.graphqlQuerySection}>
                <h4>GraphQL Query</h4>
                <div className={styles.codeBlock}>
                  <pre>
                    <code>{graphqlQuery}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

MessageMetadata.propTypes = {
  steps: PropTypes.arrayOf(PropTypes.object),
  graphqlQuery: PropTypes.string,
};

export default MessageMetadata; 