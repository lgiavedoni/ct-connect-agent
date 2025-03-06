import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import Tag from '@commercetools-uikit/tag';
import { TagList } from '@commercetools-frontend/ui-kit';
import { QUERY_TYPES, ENTITY_TYPES } from '../../models/chat-response';
import styles from './message-metadata.module.css';

// GraphQL logo URL
const GRAPHQL_LOGO_URL = 'https://www.vectorlogo.zone/logos/graphql/graphql-icon.svg';

// Map entity types to tag types for visual distinction
const ENTITY_TAG_TYPES = {
  [ENTITY_TYPES.PRODUCTS]: 'normal',
  [ENTITY_TYPES.ORDERS]: 'normal',
  [ENTITY_TYPES.CUSTOMERS]: 'normal',
  [ENTITY_TYPES.CARTS]: 'normal',
  [ENTITY_TYPES.CATEGORIES]: 'normal',
};

// Map query types to tag types
const QUERY_TAG_TYPES = {
  [QUERY_TYPES.READ]: 'normal',
  [QUERY_TYPES.WRITE]: 'normal',
};

const EntityTags = ({ entities }) => {
  if (!entities || entities.length === 0) return null;
  
  // Create tag elements for each entity
  const tags = entities.map((entity, index) => (
    <Tag 
      key={`entity-${index}`}
      type="normal"
    >
      {entity.entity_type}
    </Tag>
  ));
  
  return (
    <div className={styles.entityTags}>
      <TagList>{tags}</TagList>
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
  
  // Create tag elements for query types
  const queryTypeTags = queries.map((query, index) => (
    <Tag
      key={`query-type-${index}`}
      type="normal"
    >
      {query.query_type}
    </Tag>
  ));
  
  return (
    <div className={styles.queriesPanel}>
      <Spacings.Stack scale="s">
        <div className={styles.queriesHeader}>
          <Text.Body isBold>
            GraphQL Queries ({queries.length})
          </Text.Body>
          <div className={styles.queryTypeTags}>
            <TagList>{queryTypeTags}</TagList>
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