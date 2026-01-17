import { useState } from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Close,
  PersonOutline,
  Place,
  Settings,
  ReceiptLong
} from "@mui/icons-material";
import {
  ProfileTab,
} from "./tabs";


interface UserProfileProps {
  onClose: () => void;
}

export const Profile = ({onClose}: UserProfileProps) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'addresses' | 'orders' | 'settings'>('profile');

  const tabs = [
    {id: 'profile' as const, label: 'ProfileTab', icon: PersonOutline},
    {id: 'addresses' as const, label: 'Addresses', icon: Place},
    {id: 'orders' as const, label: 'Orders', icon: ReceiptLong},
    {id: 'settings' as const, label: 'Settings', icon: Settings},
  ];

  return (
    <Dialog
      open={true}
      onClose={onClose}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>
        <Typography
          variant="h6"
          component="div"
          sx={{
            ml: 2,
            mr: 2,
            fontWeight: 'fontWeightBold'
          }}
        >
          My Account
        </Typography>
      </DialogTitle>
      <IconButton
        aria-label="close"
        onClick={onClose}
        sx={(theme) => ({
          position: 'absolute',
          right: 8,
          top: 8,
          color: theme.palette.grey[500],
        })}
      >
        <Close/>
      </IconButton>
      <DialogContent dividers>
        <Box sx={{display: 'flex', height: 'calc(90vh - 88px)'}}>
          {/* Sidebar */}
          <Box sx={{width: 256, borderRight: 1, borderColor: 'divider', bgcolor: 'grey.50', p: 2}}>
            <List>
              {tabs.map((tab) => (
                <ListItemButton
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  selected={activeTab === tab.id}
                  sx={{
                    borderRadius: 1,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {bgcolor: 'primary.dark'}
                    },
                    '&:hover': {bgcolor: 'grey.200'}
                  }}
                >
                  <ListItemIcon sx={{minWidth: 40}}>
                    <tab.icon sx={{color: activeTab === tab.id ? 'primary.contrastText' : 'inherit'}}/>
                  </ListItemIcon>
                  <ListItemText primary={tab.label}/>
                </ListItemButton>
              ))}
            </List>
          </Box>

          {/* Content */}
          <Box sx={{flexGrow: 1, overflowY: 'auto', p: 3}}>
            {activeTab === 'profile' && (
              <ProfileTab />
            )}
            {activeTab === 'addresses' && (
              <h6>Addresses</h6>
            )}
            {activeTab === 'orders' && (
              <h6>Orders</h6>
            )}
            {activeTab === 'settings' && (
              <h6>Settings</h6>
            )}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
