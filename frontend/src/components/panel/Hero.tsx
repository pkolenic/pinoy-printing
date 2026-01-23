import {
  Box,
  Container,
  Grid,
  Typography,
} from '@mui/material';

interface HeroProps {
  title?: string;
  description?: string;
  imageUrl?: string;
}

export const Hero = ({title = "", description = "", imageUrl = ""}: HeroProps) => {
  return (
    <Box sx={{
      flexGrow: 1,
      padding: 4,
      bgcolor: 'background.paper'
    }}>
      <Container>
        <Grid container spacing={4} alignItems="center">
          {/* Text Section */}
          <Grid size={{xs: 12, md: 6}}>
            {title && (
              <Typography variant="h3" component="h1" gutterBottom>
                {title}
              </Typography>
            )}
            {description && (
              <Typography variant="body1">
                {description}
              </Typography>
            )}
          </Grid>

          {/* Image Section */}
          <Grid size={{xs: 12, md: 6}}>
            {imageUrl && (
              <Box
                component="img"
                sx={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: '8px',
                  boxShadow: 3,
                  maxWidth: '100%',
                }}
                alt="Site Hero Photo"
                src={imageUrl}
              />
            )}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
