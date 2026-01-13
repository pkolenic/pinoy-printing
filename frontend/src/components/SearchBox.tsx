import {styled, alpha} from '@mui/material/styles';
import InputBase from '@mui/material/InputBase';
import SearchIcon from '@mui/icons-material/Search';

const Search = styled('div')(({theme}) => ({
  position: 'relative',
  borderRadius: `${Number(theme.shape.borderRadius) * 5}px`,
  backgroundColor: 'rgba(243,243,245, 1.0)',
  transition: theme.transitions.create(['box-shadow', 'background-color'], {
    duration: theme.transitions.duration.shortest,
  }),
  '&:focus-within': {
    backgroundColor: alpha(theme.palette.common.black, 0.1),
    border: '1px solid #888',
    boxShadow: '0 0 10px 0 rgba(209, 209, 209, 1.0)',
  },
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({theme}) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  // Ensure icon scales if you increase font size
  '& svg': {
    fontSize: '1.5rem',
  }
}));

const StyledInputBase = styled(InputBase)(({theme}) => ({
  color: 'inherit',
  width: '100%',
  fontSize: '1.0rem',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 2, 1, 0),
    // vertical padding + font size from searchIcon
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    [theme.breakpoints.up('sm')]: {
      width: '36ch',
    },
  },
}));

export default function SearchBox() {
  return (
    <Search>
      <SearchIconWrapper>
        <SearchIcon/>
      </SearchIconWrapper>
      <StyledInputBase
        placeholder="Search…"
        inputProps={{'aria-label': 'search'}}
      />
    </Search>
  )
}