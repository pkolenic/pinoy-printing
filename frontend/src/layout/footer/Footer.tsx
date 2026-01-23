import {
  Box,
  Container,
  Divider,
  Grid,
  Link,
  Typography,
} from '@mui/material';
import { Favorite as FavoriteIcon, Phone as PhoneIcon, } from '@mui/icons-material';

const quickLinks = ['About Us', 'Track Order'];
const customerServiceLinks = ['Shipping Info', 'Returns & Exchanges', 'FAQ'];

export const Footer = () => {
  const shopName = import.meta.env.VITE_SHOP_NAME || 'Sample0';
  const shopAddress = import.meta.env.VITE_SHOP_ADDRESS || '123 Gift Street, Present City';
  const shopEmail = import.meta.env.VITE_SHOP_EMAIL || 'hello@mcfamtrading.com'
  const shopPhone = import.meta.env.VITE_SHOP_PHONE || '(585) 123-GIFT';
  const shopPhoneForTelephone = `tel:${shopPhone.replace(/[^\d+]/g, '')}`;

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'background.paper',
        paddingTop: 6,
        paddingBottom: 2,
        marginTop: 'auto',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} justifyContent="space-between">

          {/* Section 1: Company Info */}
          <Grid size={{xs: 12, md: 4}}>
            <Typography variant="h6" component="p" gutterBottom>
              {shopName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your one-stop destination for thoughtful gifts that create lasting memories.
            </Typography>
          </Grid>

          {/* Section 2: Quick Links */}
          <Grid size={{xs: 6, md: 2}}>
            <Typography variant="subtitle1" gutterBottom>
              Quick Links
            </Typography>
            <Box sx={{display: 'flex', flexDirection: 'column'}}>
              {quickLinks.map((link) => (
                <Link href="#" variant="body2" color="text.secondary" key={link} sx={{mb: 0.5}}>
                  {link}
                </Link>
              ))}
            </Box>
          </Grid>

          {/* Section 3: Customer Service */}
          <Grid size={{xs: 6, md: 2}}>
            <Typography variant="subtitle1" gutterBottom>
              Customer Service
            </Typography>
            <Box sx={{display: 'flex', flexDirection: 'column'}}>
              {customerServiceLinks.map((link) => (
                <Link href="#" variant="body2" color="text.secondary" key={link} sx={{mb: 0.5}}>
                  {link}
                </Link>
              ))}
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{my: 3}}/>
        {/* Bottom Bar: Copyright and Contact Info */}
        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1}}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{display: 'inline', mr: 2}}>
              {shopAddress}
            </Typography>
            <Link
              href={shopPhoneForTelephone}
              color="text.secondary"
              underline="hover"
              sx={{display: 'flex', alignItems: 'center', gap: 0.5}}
            >
              <PhoneIcon sx={{fontSize: 16}}/>
              <Typography variant="body2" color="inherit">
                {shopPhone}
              </Typography>
            </Link>
            <Typography variant="body2" color="text.secondary" sx={{display: 'inline'}}>
              {shopEmail}
            </Typography>
          </Box>
          <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
            <Typography variant="body2" color="text.secondary">
              Made with
            </Typography>
            <FavoriteIcon sx={{color: 'red', fontSize: 16}}/>
            <Typography variant="body2" color="text.secondary">
              for gift lovers.
            </Typography>
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" align="center" sx={{mt: 2}}>
          {'© '}
          {new Date().getFullYear()}
          {` ${shopName}. All rights reserved.`}
        </Typography>
      </Container>
    </Box>
  );
};
