import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';

const INTEGRATIONS = [
  { provider: 'jira', label: 'Jira', description: 'Pull assigned tickets into your work items' },
  { provider: 'bitbucket', label: 'Bitbucket', description: 'Track open PRs and review requests' },
  { provider: 'calendar', label: 'Calendar', description: 'See meeting counts and available focus time' },
];

export default function Settings() {
  return (
    <Box sx={{ maxWidth: 700 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Typography variant="h6" sx={{ mb: 2, fontSize: '1rem' }}>
        Integrations
      </Typography>

      {INTEGRATIONS.map((integration) => (
        <Card key={integration.provider} sx={{ mb: 2 }}>
          <CardContent
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              py: '16px !important',
            }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {integration.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {integration.description}
              </Typography>
            </Box>
            <Chip label="Coming soon" size="small" variant="outlined" />
          </CardContent>
        </Card>
      ))}

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        Integrations will be available in Phase 3-4. For now, use the Inbox and Board to manage
        your work manually.
      </Typography>
    </Box>
  );
}
