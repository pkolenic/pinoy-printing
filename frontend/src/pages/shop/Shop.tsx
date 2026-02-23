import { Fragment } from 'react';
import {
  useAppSelector,
  useSiteConfig,
} from '../../hooks';
import {
  Box,
  Container,
} from '@mui/material';
import {
  Hero,
} from '../../components';

import { categoryFeature } from "../../features";

export const Shop = () => {
  // Prefetch categories
  categoryFeature.useGetCategoryTreeQuery();

  const selectedCategory = useAppSelector((state) => state.filter.selectedCategory);

  const {heroTitle, heroDescription, heroImage } = useSiteConfig(['heroTitle', 'heroDescription', 'heroImage']);

  return (
    <Fragment>
      <Hero
        title={heroTitle}
        description={heroDescription}
        imageUrl={heroImage}
      />
      <Container>
        <Box sx={{my: 2}}>
          <h2>{ selectedCategory.name }</h2>
          {[...new Array(12)]
            .map(
              () => `Cras mattis consectetur purus sit amet fermentum.
Cras justo odio, dapibus ac facilisis in, egestas eget quam.
Morbi leo risus, porta ac consectetur ac, vestibulum at eros.
Praesent commodo cursus magna, vel scelerisque nisl consectetur et.`,
            )
            .join('\n')}
        </Box>
      </Container>
    </Fragment>
  )
}
