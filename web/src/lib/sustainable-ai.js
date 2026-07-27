"use strict";

// Sustainable AI Analytics Engine
// Core logic for sustainability metrics, bias calculation, and recommendations

class SustainableAnalyst {
  constructor() {
    this.stopWords = new Set([
      'what', 'is', 'the', 'how', 'to', 'of', 'in', 'on', 'for',
      'and', 'or', 'but', 'a', 'an', 'the', 'this', 'that', 'these',
      'those', 'it', 'they', 'we', 'you', 'he', 'she', 'his', 'her'
    ]);
    
    this.sustainabilityWeights = {
      energy: 0.30,
      carbon: 0.25,
      water: 0.15,
      bias: 0.15,
      accuracy: 0.15
    };
    
    this.sessionStore = new Map();
  }

  async analyzeQuery(query, userContext = null) {
    const startTime = Date.now();
    
    const searchResults = await this.searchWithSustainabilityMetrics(query, userContext);
    const metrics = this.calculateComprehensiveMetrics(query, searchResults);
    const recommendations = this.generateRecommendations(metrics, userContext);
    const sustainabilityTips = this.generateSustainabilityTips(metrics);
    
    const result = {
      query: this.truncateQuery(query),
      accuracy: metrics.accuracy,
      bias: metrics.bias,
      environmental: metrics.environmental,
      sustainabilityScore: metrics.sustainabilityScore,
      latency_s: (Date.now() - startTime) / 1000,
      timestamp: new Date().toISOString(),
      searchResults: searchResults.results,
      recommendations,
      sustainabilityTips
    };
    
    return result;
  }

  async searchWithSustainabilityMetrics(query, userContext = null) {
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&pretty=1`;
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    const abstract = data.AbstractText || '';
    const relatedTopics = data.RelatedTopics?.slice(0, 3) || [];
    const allText = [abstract, ...relatedTopics.map(t => t.Text)].join(' ').substring(0, 5000);
    
    const metrics = {
      query: query,
      textLength: allText.length,
      sourceCount: this.extractSourceCount(data),
      domainDiversity: this.calculateDomainDiversity(data),
      contentFreshness: this.calculateContentFreshness(data),
      timestamp: new Date().toISOString()
    };
    
    return {
      results: allText,
      metrics: metrics,
      sources: this.extractSources(data)
    };
  }

  calculateAccuracy(query, searchResults) {
    const queryWords = query.toLowerCase()
      .split(/\s+/)
      .filter(word => !this.stopWords.has(word))
      .filter(word => word.length > 3);
    
    const textWords = searchResults.results.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const matchedWords = queryWords.filter(word => 
      textWords.some(textWord => textWord.includes(word))
    );
    
    return Math.min(matchedWords.length / Math.max(queryWords.length, 1), 1);
  }

  calculateDiversityBias(searchResults) {
    const domains = this.extractDomainList(searchResults.sources || []);
    const uniqueDomains = new Set(domains);
    const totalSources = domains.length;
    
    return Math.max(0, 1 - (uniqueDomains.size / Math.max(totalSources, 1)));
  }

  extractDomainList(sources) {
    return sources.map(source => source.domain || 'unknown');
  }

  extractSources(data) {
    const sources = [];
    
    if (data.AbstractURL) {
      sources.push({
        title: data.AbstractSource || 'Abstract',
        url: data.AbstractURL,
        domain: new URL(data.AbstractURL).hostname,
        type: 'abstract'
      });
    }
    
    if (data.Image) {
      sources.push({
        title: data.ImageAlt || 'Image',
        url: data.Image,
        domain: new URL(data.Image).hostname,
        type: 'image'
      });
    }
    
    if (data.RelatedTopics?.length > 0) {
      data.RelatedTopics.forEach((topic, index) => {
        if (topic.FirstURL && topic.Text) {
          try {
            sources.push({
              title: topic.Text.substring(0, 100) + '...',
              url: topic.FirstURL,
              domain: new URL(topic.FirstURL).hostname,
              type: 'related_topic'
            });
          } catch (e) {
            // Invalid URL, skip
          }
        }
      });
    }
    
    return sources;
  }

  calculateEnvironmentalImpact(searchResults) {
    const baseEnergy = 0.0003;
    const baseWater = 1.8;
    
    const complexity = Math.min(searchResults.textLength / 1000, 5);
    const contentScore = this.calculateContentSustainability(searchResults.sources);
    
    return {
      energy_kwh: baseEnergy * (1 + complexity * 0.5) * contentScore,
      water_liters: baseWater * (1 + complexity * 0.3) * contentScore,
      carbon_g: (baseEnergy * 442) * (1 + complexity * 0.4) * contentScore,
      renewable_ratio: 0.3 + Math.random() * 0.4
    };
  }

  calculateContentSustainability(sources) {
    let score = 1.0;
    
    // Increase score for diverse sources
    const domains = new Set(sources.map(s => s.domain)).size;
    score += Math.min((domains - 1) * 0.1, 0.3);
    
    // Decrease score for very long content
    const totalTextLength = sources.reduce((sum, s) => sum + (s.text?.length || 0), 0);
    if (totalTextLength > 5000) score -= 0.2;
    
    return Math.max(0, Math.min(1, score));
  }

  calculateOverallSustainability(metrics) {
    const weights = this.sustainabilityWeights;
    const normalizedMetrics = {
      energy: Math.max(0, 1 - metrics.environmental.energy_kwh / 0.1),
      carbon: Math.max(0, 1 - metrics.environmental.carbon_g / 100),
      water: Math.max(0, 1 - metrics.environmental.water_liters / 50),
      bias: 1 - metrics.bias,
      accuracy: metrics.accuracy
    };
    
    const score = Object.entries(normalizedMetrics).reduce((sum, [key, value]) => 
      sum + value * weights[key], 0
    );
    
    return Math.round(score * 100) / 100;
  }

  generateRecommendations(metrics, userContext = null) {
    const recommendations = [];
    
    if (metrics.accuracy < 0.7) {
      recommendations.push({
        type: 'improve_accuracy',
        message: 'Try more specific search terms to get better results',
        impact: 'high'
      });
    }
    
    if (metrics.bias > 0.5) {
      recommendations.push({
        type: 'diversify_sources',
        message: 'Search across different sources to reduce bias',
        impact: 'medium'
      });
    }
    
    if (metrics.sustainabilityScore < 0.6) {
      recommendations.push({
        type: 'reduce_complexity',
        message: 'Simplify searches to reduce environmental impact',
        impact: 'low'
      });
    }
    
    if (userContext?.frequentQueries?.includes('sustainability')) {
      recommendations.push({
        type: 'tailor_content',
        message: 'Create personalized sustainability dashboards',
        impact: 'high'
      });
    }
    
    return recommendations;
  }

  generateSustainabilityTips(metrics) {
    const tips = [];
    
    if (metrics.accuracy < 0.7) {
      tips.push('💡 Try using more specific keywords and avoid common words like "the" or "is".');
    }
    
    if (metrics.bias > 0.5) {
      tips.push('🌐 Expand your search horizons - explore sources with different perspectives and expertise.');
    }
    
    if (metrics.sustainabilityScore < 0.7) {
      tips.push('⚡ Reduce search complexity: shorter queries often give better results with lower environmental impact.');
    }
    
    if (metrics.sustainabilityScore > 0.8) {
      tips.push('🌟 Excellent sustainability! Your search strategies are very efficient - consider sharing your approach with others.');
    }
    
    return tips;
  }

  truncateQuery(query) {
    return query.length > 45 ? query.substring(0, 45) + '...' : query;
  }

  async searchCurrentData(query, context = null) {
    return await this.searchWithSustainabilityMetrics(query, context);
  }

  async calculateEnvironmentalMetrics(userId = null) {
    return {
      total_searches: 150,
      total_energy: 0.045,
      total_carbon: 20,
      total_water: 81,
      average_accuracy: 0.78,
      bias_trend: 0.3,
      sustainability_score: 0.72,
      recommendations_count: 23
    };
  }

  async analyzeUserPattern(userId) {
    return {
      usagePattern: 'balanced',
      sustainabilityTrend: 'improving',
      recommendationEffectiveness: 'high',
      environmentalImpact: {
        co2_saved: 72,
        energy_optimized: true,
        bias_reduced: true
      }
    };
  }

  generateReflectionPrompt(sessionData) {
    const sustainabilityScore = sessionData.sustainabilityScore || 0.5;
    const sessionDuration = sessionData.duration || 0;
    
    const prompts = [
      {
        condition: sustainabilityScore < 0.6,
        text: "How did today's activities align with your sustainability goals?",
        tip: 'Try incorporating more sustainable practices into your routine.'
      },
      {
        condition: sessionDuration > 90,
        text: "Reflect on how extended sessions affect your sustainability practices.",
        tip: 'Consider shorter, focused sessions for better environmental impact.'
      },
      {
        condition: sustainabilityScore > 0.8,
        text: "Congratulations on maintaining high sustainability! What strategies helped you achieve this?",
        tip: 'Share your best practices with others in your collaborative spaces.'
      },
      {
        condition: sessionDuration === 0,
        text: "Start tracking your sustainability journey today!",
        tip: 'Begin with small, consistent actions to build momentum.'
      }
    ];
    
    const matchedPrompt = prompts.find(p => 
      typeof p.condition === 'function' ? p.condition(sessionData) : p.condition
    );
    
    return matchedPrompt?.text || "What sustainable impact did this session have on your goals?";
  }

  startSession(userId, context = {}) {
    const sessionId = Math.random().toString(36).substr(2, 9);
    const session = {
      id: sessionId,
      userId,
      startTime: Date.now(),
      context,
      actions: [],
      broken: false,
      sustainabilityScore: 0
    };
    
    this.sessionStore.set(sessionId, session);
    return session;
  }

  endSession(sessionId) {
    const session = this.sessionStore.get(sessionId);
    if (!session) return null;
    
    const sessionDuration = Date.now() - session.startTime;
    const totalSustainability = session.actions.reduce((sum, action) => 
      sum + (action.sustainability_impact || 0), 0
    );
    
    session.sustainabilityScore = session.actions.length > 0 ? 
      totalSustainability / session.actions.length : 0;
    
    const report = {
      sessionId,
      duration: sessionDuration,
      actions: session.actions.length,
      sustainabilityScore: session.sustainabilityScore,
      broken: session.broken,
      reflectionPrompt: this.generateReflectionPrompt(session)
    };
    
    this.sessionStore.delete(sessionId);
    return report;
  }
}

module.exports = { SustainableAnalyst };