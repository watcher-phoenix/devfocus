const { Router } = require('express');
const { UserSettings, WorkItem, CachedEvent, Project } = require('../database/models');
const { Op } = require('sequelize');

const router = Router();

// Clippy-style FAQ answers
const FAQ = [
  { patterns: ['what is brain dump', 'brain dump', 'what does brain dump'], answer: "It looks like you're wondering about Brain Dump! That's your quick-capture zone — just type anything and hit Enter. No need to organize, categorize, or think about it. Items land in the Brain Dump column on the Work page. When you have a moment, head over there and triage them. Would you like me to explain how triage works?" },
  { patterns: ['how do i capture', 'quick capture', 'ctrl k', 'ctrl+k'], answer: "I see you want to capture something! You've got three ways:\n\n1. Ctrl+K from any page — my personal favorite!\n2. The Brain Dump input right on the Today page\n3. The + button in the bottom-right corner\n\nThe fastest? Ctrl+K. Try it right now — I'll wait!" },
  { patterns: ['what is work', 'work page', 'how does work'], answer: "It looks like you're trying to manage your work! The Work page is your command table — filter by status, type, or project. Click any row to edit it. The key workflow is: Brain Dump → Active → Waiting/Later → Done. Pro tip: use the checkboxes to bulk-edit multiple items at once!" },
  { patterns: ['what is plan', 'plan page', 'how do i plan', 'weekly planner'], answer: "Planning your week? Great idea! The Plan page shows Mon-Fri with your meetings already there. Drag items from the Unscheduled list onto days, or use the quick-assign buttons. I'll even suggest what to schedule based on your focus time! Check the Snapshots tab too — it saves where you left off on projects." },
  { patterns: ['what are snapshots', 'context snapshot', 'save context', 'where i left off'], answer: "It looks like you're switching projects! Context Snapshots are your best friend here. Save what you were working on, your next steps, and the branch name. When you come back to that project (maybe days later), you won't waste 30 minutes remembering where you were. Trust me, future you will thank present you!" },
  { patterns: ['what is trends', 'trends page', 'career evidence'], answer: "Ooh, Trends is the good stuff! It shows everything you've accomplished over time — items completed, meetings attended, PRs reviewed, the works. Each work type gets its own KPI card. Use it for performance reviews or when you need evidence that you've outgrown your current role. The data doesn't lie!" },
  { patterns: ['how do i log work', 'log work', 'record what i did'], answer: "Want to record what you've done? On the Today page, look for the \"Log Work\" button in the Activity section. Fill in what you did, add a ticket ID if you want, pick the type and project, and you're done! Don't forget the \"After hours\" checkbox if you were burning the midnight oil." },
  { patterns: ['how do integrations work', 'jira setup', 'bitbucket setup', 'calendar setup'], answer: "It looks like you're setting up integrations! Head to Settings > Integrations:\n\n- Jira: needs your base URL + API token\n- Bitbucket: workspace name + access token + your display name\n- Calendar: just paste your Outlook ICS URL\n\nThey sync every 30 minutes during work hours, or hit Sync whenever you want fresh data!" },
  { patterns: ['what are statuses', 'status meaning', 'active waiting later'], answer: "Here's your status cheat sheet:\n\n- Brain Dump = unsorted, just captured\n- Active = you're working on it now\n- Waiting = blocked on someone else\n- Later = not now, but don't forget\n- Scheduled = planned for a specific date\n- Done = completed!\n\nWould you like help organizing your items?" },
  { patterns: ['keyboard shortcuts', 'shortcuts'], answer: "I love a good shortcut! Here's what we've got:\n\nCtrl+K (or Cmd+K): Quick capture from anywhere. That's it for now, but it's a good one!" },
  { patterns: ['what is today', 'today page', 'how does today work', 'what does today show'], answer: "It looks like you want to know about the Today page! That's your command center — everything you need in one place. You'll see your meetings and focus time, your priorities for the day (with checkboxes!), context snapshots for picking up where you left off, and your activity log. You can also capture thoughts right from here with the Brain Dump input at the top. It's where your day starts and ends!" },
  { patterns: ['what is a priority', 'how do priorities work', 'priority'], answer: "Priorities are items scheduled for today! They show up on the Today page with badges — High (red), Medium (yellow), and Low (gray). Check them off as you complete them. To get items into your priorities, go to Plan and drag them onto today, or edit an item and set a scheduled date!" },
  { patterns: ['help', 'what can you do', 'how do i use'], answer: "Hi there! I'm Clippy, and I'm here to help you get the most out of DevFocus! You can ask me about:\n\n- Brain Dump and capturing thoughts\n- The Work page and managing tasks\n- Planning your week\n- Context Snapshots\n- Trends and career evidence\n- Integrations setup\n- Keyboard shortcuts\n\nOr check out the Guide page for the full walkthrough!" },
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
Types: Task, Ticket, Strategic, Follow-up, Review, Jira, PR, Weekend Support.
Features: Ctrl+K capture, drag-to-schedule, Jira/Bitbucket/Calendar integrations, context snapshots, activity log, after-hours tracking.`;
}

router.post('/', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
  const faqAnswer = findFaqAnswer(message);
  if (faqAnswer) {
    return res.json({ answer: faqAnswer, source: 'faq' });
  }

  let apiKey = null;
  try {
    const settings = await UserSettings.findOne();
    apiKey = settings?.getDataValue('anthropicApiKey');
  } catch { /* settings table may not have column yet */ }

  if (!apiKey) {
    return res.json({
      answer: "Hmm, I'm not sure about that one! Check out the Guide page for detailed help, or if you add an Anthropic API key in Settings, I can get a lot smarter. Would you like me to tell you how?",
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
      system: `You are Clippy, the beloved (and slightly overeager) assistant from Microsoft Office, now living inside the DevFocus productivity app. Respond in Clippy's classic style:
- Start responses with "It looks like you're trying to..." when appropriate
- Be helpful, enthusiastic, and slightly quirky
- Offer follow-up tips with "Would you like help with that?"
- Keep answers concise but friendly
- Reference app features naturally and suggest related ones
- Use light humor but stay genuinely helpful

Here's the current app context:\n\n${context}`,
      messages: [{ role: 'user', content: message }],
    });

    return res.json({ answer: response.content[0].text, source: 'ai' });
  } catch (err) {
    console.error('Chat AI error:', err.message);
    return res.json({
      answer: "Oops! I couldn't connect to my brain right now. Check your API key in Settings, or ask me something from the FAQ — I know those by heart!",
      source: 'error',
    });
  }
  } catch (err) {
    console.error('Chat endpoint error:', err.message);
    return res.status(500).json({ answer: 'Something went wrong. Try again!', source: 'error' });
  }
});

module.exports = router;
