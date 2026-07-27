"use strict";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const userId = searchParams.get('userId');
  
  switch(action) {
    case 'get-metrics':
      return await getSustainabilityMetrics();
    case 'get-profile':
      return await getUserProfile(userId);
    case 'get-conferences':
      return await getConferences();
    case 'get-bases':
      return await getBases();
    case 'get-projects':
      return await getProjects();
    default:
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
  }
}

export async function POST(request) {
  const { action } = await request.json();
  
  switch(action) {
    case 'analyze':
      return await analyzeQuery(request);
    case 'create-session':
      return await createSession(request);
    case 'end-session':
      return await endSession(request);
    case 'create-base':
      return await createBase(request);
    case 'join-base':
      return await joinBase(request);
    case 'create-project':
      return await createProject(request);
    case 'create-conference':
      return await createConference(request);
    default:
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
  }
}

async function getSustainabilityMetrics() {
  const SustainableAnalyst = require('../lib/sustainable-ai').SustainableAnalyst;
  const analyst = new SustainableAnalyst();
  const metrics = await analyst.calculateEnvironmentalMetrics();
  
  return new Response(JSON.stringify({
    success: true,
    metrics,
    lastUpdated: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getUserProfile(userId) {
  // Mock user profile for now
  return new Response(JSON.stringify({
    success: true,
    user: {
      id: userId,
      name: 'John Doe',
      email: 'john@example.com',
      sustainabilityScore: 0.78,
      createdAt: '2024-01-15T10:30:00Z',
      lastLogin: new Date().toISOString()
    },
    stats: {
      basesJoined: 3,
      projectsCreated: 5,
      conferencesAttended: 2,
      energySaved: 12.5,
      co2Reduced: 8.2
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getConferences() {
  return new Response(JSON.stringify({
    success: true,
    conferences: [
      {
        id: 'conf-1',
        title: 'Sustainable AI Summit 2024',
        date: '2024-06-15T09:00:00Z',
        endDate: '2024-06-17T18:00:00Z',
        location: 'Virtual',
        sustainabilityScore: 0.85,
        organizer: 'GreenTech Foundation'
      },
      {
        id: 'conf-2',
        title: 'Climate Tech Innovation Conference',
        date: '2024-07-20T10:00:00Z',
        endDate: '2024-07-22T17:00:00Z',
        location: 'San Francisco, CA',
        sustainabilityScore: 0.92,
        organizer: 'ClimateTech Alliance'
      },
      {
        id: 'conf-3',
        title: 'AI for Environmental Conservation',
        date: '2024-08-05T14:00:00Z',
        endDate: '2024-08-07T20:00:00Z',
        location: 'Online',
        sustainabilityScore: 0.88,
        organizer: 'Conservation Tech Network'
      }
    ]
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getBases() {
  return new Response(JSON.stringify({
    success: true,
    bases: [
      {
        id: 'base-1',
        name: 'Climate Action Hub',
        description: 'Collaborative space for climate projects',
        creator: 'Alice Johnson',
        memberCount: 12,
        sustainabilityRating: 0.92,
        isPublic: true,
        tools: ['ai-search', 'analysis', 'recommendations']
      },
      {
        id: 'base-2',
        name: 'Sustainable Tech Studio',
        description: 'Innovation space for sustainable technology',
        creator: 'Bob Smith',
        memberCount: 8,
        sustainabilityRating: 0.88,
        isPublic: true,
        tools: ['ai-analysis', 'studio', 'chat']
      },
      {
        id: 'base-3',
        name: 'Green Business Network',
        description: 'Collaborative space for sustainable business practices',
        creator: 'Carol Williams',
        memberCount: 15,
        sustainabilityRating: 0.95,
        isPublic: false,
        tools: ['recommendations', 'analytics', 'studio']
      }
    ]
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getProjects() {
  return new Response(JSON.stringify({
    success: true,
    projects: [
      {
        id: 'project-1',
        title: 'Urban Renewable Energy Dashboard',
        creator: 'John Doe',
        baseId: 'base-1',
        status: 'active',
        sustainabilityImpact: {'co2_saved': 50, 'energy_optimized': true},
        aiToolsUsed: ['analysis', 'recommendations']
      },
      {
        id: 'project-2',
        title: 'Community Solar Planning Tool',
        creator: 'Jane Smith',
        baseId: 'base-2',
        status: 'in-progress',
        sustainabilityImpact: {'co2_saved': 75, 'energy_optimized': true},
        aiToolsUsed: ['search', 'studio']
      }
    ]
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function analyzeQuery(request) {
  const { query, userId } = await request.json();
  
  const SustainableAnalyst = require('../lib/sustainable-ai').SustainableAnalyst;
  const analyst = new SustainableAnalyst();
  const result = await analyst.analyzeQuery(query);
  
  return new Response(JSON.stringify({
    success: true,
    analysis: result,
    userId
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function createSession(request) {
  const { userId, context } = await request.json();
  
  const SustainableAnalyst = require('../lib/sustainable-ai').SustainableAnalyst;
  const analyst = new SustainableAnalyst();
  const session = analyst.startSession(userId, context);
  
  return new Response(JSON.stringify({
    success: true,
    session
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function endSession(request) {
  const { sessionId } = await request.json();
  
  const SustainableAnalyst = require('../lib/sustainable-ai').SustainableAnalyst;
  const analyst = new SustainableAnalyst();
  const report = analyst.endSession(sessionId);
  
  return new Response(JSON.stringify({
    success: true,
    report
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function createBase(request) {
  const { userId, name, description, tools } = await request.json();
  
  const newBase = {
    id: `base-${Date.now()}`, 
    name,
    description,
    creator: userId,
    memberCount: 1,
    sustainabilityRating: 0.85,
    isPublic: true,
    tools,
    createdAt: new Date().toISOString()
  };
  
  return new Response(JSON.stringify({
    success: true,
    base: newBase
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function joinBase(request) {
  const { baseId, userId } = await request.json();
  
  const updatedBase = {
    ...mockBases.find(b => b.id === baseId),
    memberCount: mockBases.find(b => b.id === baseId).memberCount + 1
  };
  
  return new Response(JSON.stringify({
    success: true,
    base: updatedBase
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function createProject(request) {
  const { userId, title, description, baseId } = await request.json();
  
  const newProject = {
    id: `project-${Date.now()}`,
    title,
    description,
    creator: userId,
    baseId,
    status: 'active',
    sustainabilityImpact: {'co2_saved': 10, 'energy_optimized': true},
    aiToolsUsed: ['analysis', 'recommendations'],
    createdAt: new Date().toISOString()
  };
  
  return new Response(JSON.stringify({
    success: true,
    project: newProject
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function createConference(request) {
  const { userId, title, description, date, location } = await request.json();
  
  const newConference = {
    id: `conf-${Date.now()}`,
    title,
    description,
    organizer: userId,
    date,
    location,
    isActive: true,
    sustainabilityScore: 0.90,
    createdAt: new Date().toISOString()
  };
  
  return new Response(JSON.stringify({
    success: true,
    conference: newConference
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Mock data
const mockBases = [
  {
    id: 'base-1',
    name: 'Climate Action Hub',
    creator: 'Alice Johnson',
    memberCount: 12,
    sustainabilityRating: 0.92,
    isPublic: true,
    tools: ['ai-search', 'analysis', 'recommendations']
  },
  {
    id: 'base-2',
    name: 'Sustainable Tech Studio',
    creator: 'Bob Smith',
    memberCount: 8,
    sustainabilityRating: 0.88,
    isPublic: true,
    tools: ['ai-analysis', 'studio', 'chat']
  },
  {
    id: 'base-3',
    name: 'Green Business Network',
    creator: 'Carol Williams',
    memberCount: 15,
    sustainabilityRating: 0.95,
    isPublic: false,
    tools: ['recommendations', 'analytics', 'studio']
  }
];