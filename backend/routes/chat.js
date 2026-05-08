const { Router } = require('express');
const { UserSettings, WorkItem, CachedEvent, Project } = require('../database/models');
const { Op } = require('sequelize');

const router = Router();

// FAQ answers for common questions
const FAQ = [
  { patterns: ['what is brain dump', 'brain dump', 'what does brain dump'], answer: 'Brain Dump is for getting things out of your head as fast as possible. Just type and hit Enter — no categories, no priority. Items land in the Brain Dump column on the Work page. When you have time, go to Work and triage them: move to Active, Waiting, Later, or Done.' },
  { patterns: ['how do i capture', 'quick capture', 'ctrl k', 'ctrl+k'], answer: 'Three ways to capture: 1) Ctrl+K from any page opens a quick capture popup. 2) The Brain Dump input on the Today page. 3) The + button in the bottom-right corner.' },
  { patterns: ['what is work', 'work page', 'how does work'], answer: 'The Work page is a table of all your items. Filter by status, type, or project. Click any row to edit. Use the status dropdown to move items through your workflow: Brain Dump → Active → Waiting/Later → Done.' },
  { patterns: ['what is plan', 'plan page', 'how do i plan', 'weekly planner'], answer: 'Plan shows your week Mon-Fri. Drag unscheduled items onto days, or use the day buttons/date picker. It auto-detects meeting vs focus days from your calendar. The Snapshots tab saves where you left off on projects.' },
  { patterns: ['what are snapshots', 'context snapshot', 'save context', 'where i left off'], answer: 'Context Snapshots save where you stopped on a project — what you were doing, next steps, branch name. Create one when you switch projects so you can pick up without losing context later.' },
  { patterns: ['what is trends', 'trends page', 'career evidence'], answer: 'Trends shows metrics over time: items completed, meetings attended, PRs reviewed, work type breakdown, project distribution, and after-hours work. Use it as evidence for performance reviews or to show you\'ve outgrown your current role.' },
  { patterns: ['how do i log work', 'log work', 'record what i did'], answer: 'On the Today page, expand the Activity section and click "Log Work". Or use the "Log Work" button in the header. Fill in what you did, optional ticket ID, type, project, and date.' },
  { patterns: ['how do integrations work', 'jira setup', 'bitbucket setup', 'calendar setup'], answer: 'Go to Settings > Integrations. Jira needs a base URL + API token. Bitbucket needs a workspace + access token. Calendar needs a published ICS URL from Outlook. Each syncs automatically every 30 min during work hours, or hit Sync manually.' },
  { patterns: ['what are statuses', 'status meaning', 'active waiting later'], answer: 'Brain Dump = unsorted inbox. Active = working on now. Waiting = blocked on someone. Later = future/someday. Scheduled = planned for a specific date. Done = completed.' },
  { patterns: ['keyboard shortcuts', 'shortcuts'], answer: 'Ctrl+K (or Cmd+K): Quick capture from any page.' },
];

function findFaqAnswer(question) {
  const lower = question.toLowerCase();
  for (const faq of FAQ) {
    if (faq.patterns.some((p) => lower.includes(p))) {
      return faq.answer;
    }
  }
  return null;
}

// Get app context for AI chat
async function getAppContext() {
  const itemCounts = await WorkItem.findAll({
    attributes: ['status', [require('sequelize').fn('COUNT', '*'), 'count']],
    group: ['status'],
    raw: true,
  });

  const projectCount = await Project.count({ where: { archived: false } });
  const { getTodayET } = require('../utilities/timezone');
  const todayDate = getTodayET();
  const todayEvents = await CachedEvent.count({ where: { date: todayDate, allDay: false } });

  return `DevFocus is a personal productivity app. Current state:
- Work items: ${itemCounts.map((r) => `${r.status}: ${r.count}`).join(', ')}
- Projects: ${projectCount}
- Today's meetings: ${todayEvents}

Pages: Today (command center), Work (table of items), Plan (weekly planner + snapshots), Trends (analytics), Settings, Guide.
Statuses: Brain Dump (inbox), Active, Waiting, Later, Scheduled, Done.
Types: Task, Ticket, Strategic, Follow-up, Review, Jira, PR.
Features: Ctrl+K capture, drag-to-schedule, Jira/Bitbucket/Calendar integrations, context snapshots, activity log, after-hours tracking.`;
}

router.post('/', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  // Try FAQ first
  const faqAnswer = findFaqAnswer(message);
  if (faqAnswer) {
    return res.json({ answer: faqAnswer, source: 'faq' });
  }

  // Try AI if API key is configured
  const settings = await UserSettings.findOne();
  const apiKey = settings?.getDataValue('anthropicApiKey');

  if (!apiKey) {
    return res.json({
      answer: "I'm not sure about that. Check the Guide page for detailed documentation, or add an Anthropic API key in Settings to enable AI-powered answers.",
      source: 'fallback',
    });
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const context = await getAppContext();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `You are a helpful assistant embedded in the DevFocus productivity app. Answer questions about how to use the app, explain features, and give productivity tips. Be concise and friendly. Here's the current app context:\n\n${context}`,
      messages: [{ role: 'user', content: message }],
    });

    return res.json({
      answer: response.content[0].text,
      source: 'ai',
    });
  } catch (err) {
    console.error('Chat AI error:', err.message);
    return res.json({
      answer: "Sorry, I couldn't connect to the AI. Check your API key in Settings. In the meantime, check the Guide page for help.",
      source: 'error',
    });
  }
});

module.exports = router;
