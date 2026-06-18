import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Divider from '@mui/material/Divider';

function Section({ title, children, defaultExpanded }) {
  return (
    <Accordion defaultExpanded={defaultExpanded} sx={{ bgcolor: 'background.paper', backgroundImage: 'none', '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

function P({ children }) {
  return <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{children}</Typography>;
}

function B({ children }) {
  return <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{children}</Typography>;
}

export default function Guide() {
  return (
    <Box sx={{ maxWidth: 700 }}>
      <Typography variant="h5" sx={{ mb: 1 }}>DevFocus Guide</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        How everything works and how to get the most out of DevFocus.
      </Typography>

      <Section title="The DevFocus Workflow" defaultExpanded>
        <P>DevFocus follows a simple flow: Capture, Organize, Plan, Execute, Review.</P>
        <B>1. Capture</B>
        <P>
          Throughout your day, thoughts, tasks, and follow-ups come at you from meetings, emails,
          and conversations. Use Ctrl+K or the Brain Dump input on the Today page to capture them
          instantly — no categories, no priority, just get it out of your head. These land in the
          Brain Dump column on the Work page.
        </P>
        <B>2. Organize</B>
        <P>
          Go to Work to triage your Brain Dump items. Drag them to Active (doing now),
          Waiting (blocked), Later (not now), or Done. Add projects, priorities, and ticket IDs.
        </P>
        <B>3. Plan</B>
        <P>
          Go to Plan to look at your week. Drag items from Unscheduled onto specific days.
          Mon-Wed are meeting-heavy — schedule quick wins and reviews. Thu-Fri are focus days — schedule
          deep work. Save Context Snapshots when you stop mid-project.
        </P>
        <B>4. Execute</B>
        <P>
          Open Today each morning. See your meetings, priorities, and where you left off.
          Work through your priorities. Check them off as you go.
        </P>
        <B>5. Review</B>
        <P>
          At the end of the day, check your Activity section on Today. Log any work that wasn't
          captured automatically. Save a Context Snapshot if you're mid-project. This record
          helps for standups, reviews, and proving the week wasn't wasted.
        </P>
      </Section>

      <Section title="Today — Your Command Center">
        <P>
          Today is where you spend most of your time. Everything you need is on this one page:
        </P>
        <B>Meeting count and focus time</B>
        <P>Shows how many meetings you have and how much uninterrupted time is left, based on your work hours (set in Settings). Events titled &ldquo;Focus time&rdquo; or just &ldquo;Focus&rdquo; don&rsquo;t count as meetings — that time stays in your focus minutes.</P>
        <B>Brain Dump input</B>
        <P>Type anything and hit Enter. It goes straight to the Brain Dump column on Work. No friction.</P>
        <B>Today's Meetings</B>
        <P>Your calendar events with times, durations, and locations. Requires the Outlook calendar integration.</P>
        <B>Top Priorities</B>
        <P>Items scheduled for today with medium or high priority, or status Active. Check them off right here.</P>
        <B>Active Work</B>
        <P>All items with status Active that aren't already in today's priorities. Click any item to open it. This section only appears when you have active work.</P>
        <B>Context Snapshots</B>
        <P>All your active "where I left off" snapshots. Click to edit, or create new ones.</P>
        <B>Activity</B>
        <P>Everything you got done — completed tasks, tickets, and meetings. Toggle between 7/14/30 day views. Use "Log Work" to record things manually.</P>
      </Section>

      <Section title="Brain Dump and Quick Capture">
        <P>
          Brain Dump is for getting things out of your head as fast as possible. Don't think about
          categories, priority, or projects — just type and hit Enter.
        </P>
        <B>Three ways to capture:</B>
        <P>1. Ctrl+K (or Cmd+K) — works from any page, opens a popup</P>
        <P>2. Brain Dump input on Today — always visible at the top</P>
        <P>3. The + button in the bottom-right corner</P>
        <P>
          Captured items land in the Brain Dump column on the Work page. When you have a moment,
          go to Work and triage them — move to Active, assign a project, set priority, or drag to Later.
        </P>
      </Section>

      <Section title="Work — The Board">
        <P>The Work page is a kanban board with five columns:</P>
        <B>Brain Dump (gray)</B>
        <P>Unsorted items. Everything captured lands here first. Triage regularly.</P>
        <B>Active (purple)</B>
        <P>What you're currently working on. Keep this focused — 3-5 items max.</P>
        <B>Waiting (yellow)</B>
        <P>Blocked on someone else. Check back periodically.</P>
        <B>Later (blue)</B>
        <P>Future/someday items. Not forgotten, just not now.</P>
        <B>Done (green)</B>
        <P>Completed work. These show up in your Activity on Today. When you turn on the Done switch (or filter the Status dropdown to a completion status), the table adds a sortable Completed column showing the date each item was finished.</P>
        <B>Cancelled (gray)</B>
        <P>Items that were cancelled, declined, or superseded. Jira tickets marked Won't Do/Duplicate and declined Bitbucket PRs land here automatically. Cancelled items do NOT count toward any Trends metrics. Toggle the Cancelled switch on the Board to show/hide them.</P>
        <P>Click any card to edit details. Use the "New Item" button for items that go straight to Active. Toggle the After Hours switch to filter for tasks completed outside work hours or on weekends.</P>
        <B>Rich Descriptions</B>
        <P>The description field supports rich text formatting (bold, lists, code, etc.) and image pasting. Copy a screenshot to your clipboard and paste it directly into the description — the image embeds inline.</P>
        <B>Recurring Items</B>
        <P>Set a recurrence rule (Daily, Weekly, Biweekly, Monthly) on any work item. When you complete or cancel an instance, the next one auto-spawns with the next scheduled date. Recurring items show a repeat icon on the Board. To stop the series, set recurrence to None or delete the original item.</P>
      </Section>

      <Section title="Plan — Weekly Planner and Snapshots">
        <B>Week tab</B>
        <P>
          Five columns for Mon-Fri plus an Unscheduled sidebar. Drag items from Unscheduled onto
          specific days. Use the arrows to plan future weeks. Mon-Wed default to "meetings" days,
          Thu-Fri default to "focus" days.
        </P>
        <B>Snapshots tab</B>
        <P>
          Context Snapshots save where you left off on a project. Record what you were doing,
          next steps, the branch name, and which files matter. When you come back to that project
          (maybe days later), you can pick up right where you stopped instead of spending 30
          minutes remembering what you were doing.
        </P>
        <P>Create a snapshot whenever you stop working on something mid-stream.</P>
      </Section>

      <Section title="Activity and Logging Work">
        <P>
          The Activity section on Today shows all your completed work and meetings, grouped by day.
          This gives you a full picture of where your time went.
        </P>
        <B>Automatic tracking</B>
        <P>Items you mark as Done on the Board show up automatically. Meetings from your synced calendar appear too.</P>
        <B>Manual logging</B>
        <P>Use the "Log Work" button for things that weren't on the Board — ad-hoc requests, ticket work, meetings you handled. You can set the type (Task, Ticket, Strategic, etc.), project, ticket ID, and date.</P>
        <P>Use the "Log New Item" button to create a new planned task right from Today, without going to the Board. It opens the same form as the Board's New Item, so you pick a status, type, project, dates, and recurrence — the item lands on your Board rather than being logged as already done.</P>
        <P>Click any activity item to edit it if you made a mistake.</P>
        <B>Non-task tally</B>
        <P>On Today, the "Non-task tally" card has tap-to-increment chips for the things that eat your day but never become tasks — Interrupted, Helped someone, Firefighting, Admin, Reading, Ad-hoc meeting, Context switch, Blocked / waiting, Planning, and Documentation. Tap a chip to add one; tap its × to remove one. The optional note is for jotting what pulled you away. Totals roll up on Trends.</P>
        <B>Context switches</B>
        <P>Trends shows a "Context Switches" stat — derived automatically (no logging) from the order of your completed work and meetings each day. A switch is counted whenever the context (project, or a meeting) changes. The "Context &amp; non-task activity" section lists what you actually switched between, day by day.</P>
      </Section>

      <Section title="Keyboard Shortcuts">
        <P><strong>Ctrl+K</strong> (or Cmd+K) — Quick capture from anywhere. Type and hit Enter.</P>
      </Section>

      <Section title="Secret Combos">
        <P>Type these anywhere (not in an input field) for confetti and a snarky message. There are 12 combos total — here are a few hints to get you started:</P>
        <P><strong>Konami Code</strong> — The classic. If you know, you know.</P>
        <P><strong>ship</strong> — For when you're ready to deploy.</P>
        <P><strong>yolo</strong> — For when you're feeling dangerous.</P>
        <P><strong>lgtm</strong> — Approve without reading. A tradition.</P>
        <P><strong>coffee</strong> — Deploy caffeine.</P>
        <P>There are more. Find them all. Or don't. No judgment.</P>
        <P>Completing all your priorities for the day also triggers confetti.</P>
      </Section>

      <Section title="Badges">
        <P>Badges appear on the Today page header based on your current state. They're computed in real-time — no grinding required.</P>
        <B>Achievement Badges</B>
        <P><strong>Clean Sweep</strong> — All scheduled priorities completed for the day.</P>
        <P><strong>On Fire</strong> — 10+ items completed this week.</P>
        <P><strong>Shipping Machine</strong> — 20+ items completed this week. You're unstoppable (or lying).</P>
        <P><strong>X Down</strong> — Completed 3+ priorities today. Keep going.</P>
        <B>Focus Badges</B>
        <P><strong>Deep Focus</strong> — 6+ hours of uninterrupted focus time today.</P>
        <P><strong>Meeting-Free</strong> — Zero meetings. A rare and beautiful thing.</P>
        <P><strong>Meeting Survivor</strong> — 6+ meetings today. You earned this one.</P>
        <B>Streaks</B>
        <P><strong>X-Day Streak</strong> — Completed work items on consecutive days. 3+ days shows the streak. Don't break it.</P>
        <B>Housekeeping</B>
        <P><strong>No Dust</strong> — No stale items. Everything's been touched recently.</P>
        <P><strong>TGIF</strong> — It's Friday. That's it. That's the badge.</P>
      </Section>

      <Section title="Trends — Color Reference">
        <P>The Trends page uses distinct colors for each data type so you can tell them apart at a glance. Use the CSV button for raw data or the Report button for a formatted, printable summary.</P>
        <B>Work Type Colors (By Type breakdown)</B>
        <P><span style={{ color: '#42A5F5' }}>■</span> Task — Light blue</P>
        <P><span style={{ color: '#536DFE' }}>■</span> Ticket — Indigo</P>
        <P><span style={{ color: '#7C4DFF' }}>■</span> Strategic — Purple</P>
        <P><span style={{ color: '#00BCD4' }}>■</span> Follow-up — Teal</P>
        <P><span style={{ color: '#FFD600' }}>■</span> Review — Yellow</P>
        <P><span style={{ color: '#FF6D00' }}>■</span> PR Review — Deep orange</P>
        <P><span style={{ color: '#FFB300' }}>■</span> Jira — Amber</P>
        <P><span style={{ color: '#00C853' }}>■</span> PR — Green</P>
        <P><span style={{ color: '#E91E63' }}>■</span> Support — Pink</P>
        <P><span style={{ color: '#F44336' }}>■</span> Urgent — Red</P>
        <B>Summary Stats</B>
        <P><span style={{ color: '#CE93D8' }}>■</span> Items Completed / Meetings / Meeting Hours / PRs Reviewed — Lavender</P>
        <P><span style={{ color: '#EF5350' }}>■</span> After Hours Work / Mtgs — Red</P>
        <P><span style={{ color: '#4DB6AC' }}>■</span> Out of Office (days · hours) — Muted teal</P>
        <P>Out of Office is pulled from synced calendar events marked “Show as → Out of Office”. All-day blocks count as days; timed blocks count as hours, and every 8 timed hours rolls up into one work day (so 3 days plus 11 timed hours shows as 4d · 3h). These are excluded from meeting counts, as are events titled “Focus time” or just “Focus”. When you have an all-day Out of Office block on a date, every meeting on that date is dropped from meeting counts and meeting hours. For a timed Out of Office block, the overlapping portion of each meeting is subtracted (prorated) from your meeting hours — a meeting that falls entirely inside the block drops out completely, while one that only partially overlaps keeps the time outside the block. Either way, OOO time doesn’t skew your meeting totals.</P>
        <B>Chart Colors</B>
        <P><span style={{ color: '#CE93D8' }}>■</span> Items Completed Per Week — Lavender</P>
        <P><span style={{ color: '#78909C' }}>■</span> Meeting Hours Per Week — Slate</P>
        <B>Other</B>
        <P><span style={{ color: '#8D6E63' }}>■</span> By Project bars — Brown</P>
      </Section>

      <Section title="Weekly Summary">
        <P>A focused weekly snapshot accessible from the nav. Shows items completed, meetings, project breakdown, and after-hours work for the current or previous week.</P>
        <B>Modes</B>
        <P><strong>Personal</strong> — Snarky commentary and all the details. For your eyes only.</P>
        <P><strong>Shareable</strong> — Clean, professional layout suitable for screenshots or 1:1s with your manager.</P>
        <B>Export</B>
        <P>CSV downloads a spreadsheet of all items and stats. Report opens a formatted, printable page you can save as PDF or print directly.</P>
        <B>Live Dashboard</B>
        <P>The Live Dashboard button opens a full interactive dashboard (at /report) that reads live straight from the database — click any chart or bar to drill into the underlying items. It opens with your logged-in session; to share it outside the app (e.g. embed in Glean), use the tokenized link /report?token=YOUR_READER_TOKEN.</P>
      </Section>

      <Section title="Settings">
        <B>General</B>
        <P>Set your work hours (default 7:30 AM to 4:00 PM). This affects the focus time calculation on Today.</P>
        <P>Set &ldquo;Exclude from meeting count&rdquo; to keep specific events (e.g. lunch, holds) out of your meeting count and focus-time math. Titles are matched exactly; events titled &ldquo;Focus time&rdquo; or just &ldquo;Focus&rdquo; are always excluded.</P>
        <B>Projects</B>
        <P>Create projects that map to your repos. Assign colors for visual grouping. One project can cover multiple repos (comma-separated slugs).</P>
        <B>Statuses</B>
        <P>Rename, recolor, or add custom work statuses. System statuses (Brain Dump, Active, Waiting, Later, Scheduled, Done, Cancelled) can be renamed and recolored but not deleted. Custom statuses can be added for your workflow.</P>
        <B>Integrations</B>
        <P>Connect Jira (API token), Bitbucket (access token or app password), and Outlook Calendar (ICS link). Each syncs automatically every 30 minutes during work hours, or sync on-demand with the Sync button. Set token expiry dates to get reminders before they expire.</P>
      </Section>
    </Box>
  );
}
