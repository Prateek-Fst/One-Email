const { Client } = require('@elastic/elasticsearch');

async function testElasticsearch() {
  const client = new Client({
    node: 'http://localhost:9200'
  });

  try {
    console.log('Testing Elasticsearch connection...');
    
    // Test basic connectivity
    const pingResponse = await client.ping();
    console.log('✅ Elasticsearch ping successful:', pingResponse);

    // Get cluster info
    const infoResponse = await client.info();
    console.log('✅ Elasticsearch info:', infoResponse.body);

    // Test index operations
    const indexName = 'test-emails';
    
    // Check if index exists
    const { body: exists } = await client.indices.exists({ index: indexName });
    console.log(`Index "${indexName}" exists:`, exists);

    if (!exists) {
      // Create test index
      const createResponse = await client.indices.create({
        index: indexName,
        body: {
          mappings: {
            properties: {
              subject: { type: 'text' },
              body: { type: 'text' },
              from: { type: 'keyword' }
            }
          }
        }
      });
      console.log('✅ Test index created:', createResponse.body);
    }

    // Index a test document
    const docResponse = await client.index({
      index: indexName,
      body: {
        subject: 'Test Email',
        body: 'This is a test email for Elasticsearch',
        from: 'test@example.com'
      }
    });
    console.log('✅ Test document indexed:', docResponse.body);

    // Search for the document
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for indexing
    
    const searchResponse = await client.search({
      index: indexName,
      body: {
        query: {
          match: {
            subject: 'Test'
          }
        }
      }
    });
    console.log('✅ Search results:', searchResponse.body.hits);

    // Clean up - delete test index
    await client.indices.delete({ index: indexName });
    console.log('✅ Test index deleted');

    console.log('\n🎉 All Elasticsearch tests passed! Your setup is working correctly.');

  } catch (error) {
    console.error('❌ Elasticsearch test failed:', error.message);
    console.error('Full error:', error);
  }
}

testElasticsearch();