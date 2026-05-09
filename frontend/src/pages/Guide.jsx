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
        <P>Shows how many meetings you have and how much uninterrupted time is left, based on your work hours (set in Settings).</P>
        <B>Brain Dump input</B>
        <P>Type anything and hit Enter. It goes straight to the Brain Dump column on Work. No friction.</P>
        <B>Today's Meetings</B>
        <P>Your calendar events with times, durations, and locations. Requires the Outlook calendar integration.</P>
        <B>Top Priorities</B>
        <P>Items scheduled for today with medium or high priority, or status Active. Check them off right here.</P>
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
        <P>Completed work. These show up in your Activity on Today.</P>
        <P>Click any card to edit details. Use the "New Item" button for items that go straight to Active.</P>
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
        <P>Click any activity item to edit it if you made a mistake.</P>
      </Section>

      <Section title="Keyboard Shortcuts">
        <P><strong>Ctrl+K</strong> (or Cmd+K) — Quick capture from anywhere. Type and hit Enter.</P>
        <P><strong>Konami Code</strong> (Up Up Down Down Left Right Left Right B A) — Try it. You'll see.</P>
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

      <Section title="Settings">
        <B>General</B>
        <P>Set your work hours (default 7:30 AM to 4:00 PM). This affects the focus time calculation on Today.</P>
        <B>Projects</B>
        <P>Create projects that map to your repos. Assign colors for visual grouping. One project can cover multiple repos (comma-separated slugs).</P>
        <B>Integrations</B>
        <P>Connect Jira (API token), Bitbucket (access token or app password), and Outlook Calendar (ICS link). Each syncs automatically every 30 minutes during work hours, or sync on-demand with the Sync button. Set token expiry dates to get reminders before they expire.</P>
      </Section>
    </Box>
  );
}
