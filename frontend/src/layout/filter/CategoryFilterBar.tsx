import { useAppDispatch, useAppSelector } from '../../hooks';
import { Category } from '../../features/models.ts';
import {
  categoryFeature,
  filterFeature,
} from '../../features/';

import {
  Box,
  Button,
  CircularProgress,
  Container,
  SxProps,
  Theme,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { GhostButton } from '../../components';

interface Props {
  className?: string;
  sx?: SxProps<Theme>;
}

export const CategoryFilterBar = (props: Props) => {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const selectedCategory = useAppSelector((state) => state.filter.selectedCategory);

  const { data: categories = [], isLoading } = categoryFeature.categorySlice.useGetCategoryTreeQuery();

  const onCategoryChange = (category: Category) => {
    dispatch(filterFeature.setSelectedCategory(category));
  };

  if (isLoading) {
    return <CircularProgress size={24} sx={{ m: 2 }} />;
  }

  return (
    <Container maxWidth="lg" {...props}>
      <Box
        p={isMobile ? 0 : 1}
        sx={{
          display: {
            md: 'block', // 'block' on medium screens and up
            xs: 'flex',   // 'flex' on small screens
          },
          gap: 3,
        }}
      >
        {categories.map((category: Category) => {
          const isSelected = selectedCategory.slug === category.slug;
          const Component = isSelected ? Button : GhostButton;

          return (
            <Component
              key={category.slug}
              variant="contained"
              size="small"
              onClick={() => onCategoryChange(category)}
              // Apply specific dark background color only if selected
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                ...(isSelected && {
                  backgroundColor: theme.palette.selected.main,
                  color: theme.palette.getContrastText(theme.palette.selected.main),
                  '&:hover': {
                    backgroundColor: theme.palette.selectedHover.main,
                    color: theme.palette.getContrastText(theme.palette.selectedHover.main),
                  },
                }),
              }}
            >
              {category.name}
            </Component>
          );
        })}
      </Box>
    </Container>
  );
}