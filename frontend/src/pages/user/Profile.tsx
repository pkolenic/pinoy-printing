import { useState } from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import {
  Close,
  PersonOutline,
  Place,
  Settings,
} from "@mui/icons-material";
import {
  DetailsTab,
} from "./tabs";
import {
  DialogSidebar
} from "../../layout";


interface UserProfileProps {
  onClose: () => void;
}

export const Profile = ({onClose}: UserProfileProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'addresses' | 'settings'>('details');

  const tabs = [
    {
      id: 'details' as const,
      label: 'Personal Details',
      icon: PersonOutline,
      onClick: () => setActiveTab('details'),
    },
    {
      id: 'addresses' as const,
      label: 'Addresses',
      icon: Place,
      onClick: () => setActiveTab('addresses'),
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: Settings,
      onClick: () => setActiveTab('settings'),
    },
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
          <DialogSidebar listItems={tabs} activeTab={activeTab}/>
          {/* Content */}
          <Box sx={{flexGrow: 1, overflowY: 'auto', p: 3}}>
            {activeTab === 'details' && (
              <DetailsTab />
            )}
            {activeTab === 'addresses' && (
              <h6>Addresses</h6>
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
