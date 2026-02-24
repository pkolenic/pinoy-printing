import {
  Box,
  Container,
  Grid,
  Link,
  Typography,
} from '@mui/material';
import {
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { useSiteConfig } from '../../hooks';

const quickLinks = ['About Us', 'Track Order'];
const customerServiceLinks = ['Shipping Info', 'Returns & Exchanges', 'FAQ'];

export const Footer = () => {
  const {
    name: shopName,
    address: shopAddress,
    email: shopEmail,
    phone: shopPhone,
  } = useSiteConfig('site');
  const shopPhoneForTelephone = `tel:${shopPhone.replace(/[^\d+]/g, '')}`;

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'background.paper',
        paddingTop: 2,
        paddingBottom: 2,
        marginTop: 'auto',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} justifyContent="space-between">
          {/* Section 1: Company Info */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1
              }}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ display: 'inline', mr: 2 }}>
                  {shopAddress}
                </Typography>
                <Link
                  href={shopPhoneForTelephone}
                  color="text.secondary"
                  underline="hover"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <PhoneIcon sx={{ fontSize: 16 }}/>
                  <Typography variant="body2" color="inherit">
                    {shopPhone}
                  </Typography>
                </Link>
                <Typography variant="body2" color="text.secondary" sx={{ display: 'inline' }}>
                  {shopEmail}
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Section 2: Quick Links */}
          <Grid size={{ xs: 6, md: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Quick Links
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {quickLinks.map((link) => (
                <Link href="#" variant="body2" color="text.secondary" key={link} sx={{ mb: 0.5 }}>
                  {link}
                </Link>
              ))}
            </Box>
          </Grid>

          {/* Section 3: Customer Service */}
          <Grid size={{ xs: 6, md: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Customer Service
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {customerServiceLinks.map((link) => (
                <Link href="#" variant="body2" color="text.secondary" key={link} sx={{ mb: 0.5 }}>
                  {link}
                </Link>
              ))}
            </Box>
          </Grid>
        </Grid>

        {/* Bottom Bar: Copyright and Contact Info */}
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
          {'© '}
          {new Date().getFullYear()}
          {` ${shopName}. All rights reserved.`}
        </Typography>
      </Container>
    </Box>
  );
};
