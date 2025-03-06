import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import { QUERY_TYPES, ENTITY_TYPES } from '../../models/chat-response';
import styles from './message-metadata.module.css';

// GraphQL logo URL
const GRAPHQL_LOGO_URL = 'https://www.vectorlogo.zone/logos/graphql/graphql-icon.svg';

// Map entity types to CSS class names for visual distinction
const ENTITY_TAG_CLASSES = {
  [ENTITY_TYPES.PRODUCTS]: styles.tagProducts,
  [ENTITY_TYPES.ORDERS]: styles.tagOrders,
  [ENTITY_TYPES.CUSTOMERS]: styles.tagCustomers,
  [ENTITY_TYPES.CARTS]: styles.tagCarts,
  [ENTITY_TYPES.CATEGORIES]: styles.tagCategories,
};

// Map query types to CSS class names
const QUERY_TAG_CLASSES = {
  [QUERY_TYPES.READ]: styles.tagRead,
  [QUERY_TYPES.WRITE]: styles.tagWrite,
};

// Custom tag component
const CustomTag = ({ children, className }) => (
  <span className={`${styles.customTag} ${className || ''}`}>
    {children}
  </span>
);

CustomTag.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

const EntityTags = ({ entities }) => {
  if (!entities || entities.length === 0) return null;
  
  return (
    <div className={styles.entityTags}>
      {entities.map((entity, index) => {
        // Get the CSS class for this entity type or use default
        const tagClass = ENTITY_TAG_CLASSES[entity.entity_type] || styles.tagDefault;
        
        return (
          <CustomTag 
            key={`entity-${index}`}
            className={tagClass}
          >
            {entity.entity_type}
          </CustomTag>
        );
      })}
    </div>
  );
};

EntityTags.propTypes = {
  entities: PropTypes.arrayOf(
    PropTypes.shape({
      entity_type: PropTypes.string.isRequired,
    })
  ),
};

const GraphQLQueries = ({ queries }) => {
  if (!queries || queries.length === 0) return null;
  
  return (
    <div className={styles.queriesPanel}>
      <Spacings.Stack scale="s">
        <div className={styles.queriesHeader}>
          <Text.Body isBold>
            GraphQL Queries ({queries.length})
          </Text.Body>
          <div className={styles.queryTypeTags}>
            {queries.map((query, index) => {
              // Get the CSS class for this query type or use default
              const tagClass = QUERY_TAG_CLASSES[query.query_type] || styles.tagDefault;
              
              return (
                <CustomTag
                  key={`query-type-${index}`}
                  className={tagClass}
                >
                  {query.query_type}
                </CustomTag>
              );
            })}
          </div>
        </div>
        
        {queries.map((query, index) => (
          <div key={`query-${index}`} className={styles.queryItem}>
            <Spacings.Stack scale="s">
              <Text.Detail tone="secondary">
                Query {index + 1} ({query.query_type})
              </Text.Detail>
              <pre className={styles.codeBlock}>
                <Text.Detail tone="secondary">
                  {query.query}
                </Text.Detail>
              </pre>
            </Spacings.Stack>
          </div>
        ))}
      </Spacings.Stack>
    </div>
  );
};

GraphQLQueries.propTypes = {
  queries: PropTypes.arrayOf(
    PropTypes.shape({
      query: PropTypes.string.isRequired,
      query_type: PropTypes.string.isRequired,
    })
  ),
};

const MessageMetadata = ({ metadata }) => {
  const [showQueries, setShowQueries] = useState(false);
  
  const hasQueries = metadata?.graphql_queries?.length > 0;
  const hasEntities = metadata?.entities?.length > 0;
  
  if (!hasQueries && !hasEntities) return null;
  
  const toggleQueries = () => {
    setShowQueries(!showQueries);
  };
  
  return (
    <div className={styles.metadataContainer}>
      <div className={styles.tagsRow}>
        {hasEntities && <EntityTags entities={metadata.entities} />}
        
        {hasQueries && (
          <div 
            className={styles.graphqlLogoContainer} 
            onClick={toggleQueries}
            title={showQueries ? "Hide GraphQL Queries" : `Show GraphQL Queries (${metadata.graphql_queries.length})`}
          >
            <img 
              src={GRAPHQL_LOGO_URL} 
              alt="GraphQL Logo" 
              className={`${styles.graphqlLogo} ${showQueries ? styles.graphqlLogoActive : ''}`} 
            />
            <span className={styles.queryCount}>{metadata.graphql_queries.length}</span>
          </div>
        )}
      </div>
      
      {hasQueries && showQueries && (
        <div className={styles.queriesContainer}>
          <GraphQLQueries queries={metadata.graphql_queries} />
        </div>
      )}
    </div>
  );
};

MessageMetadata.propTypes = {
  metadata: PropTypes.shape({
    graphql_queries: PropTypes.array,
    entities: PropTypes.array,
  }),
};

export default MessageMetadata; 