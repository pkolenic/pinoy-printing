import { Fragment } from 'react';
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

  return (
    <Fragment>
      <Hero
        title={import.meta.env.VITE_HERO_TITLE}
        description={import.meta.env.VITE_HERO_DESCRIPTION}
        imageUrl={import.meta.env.VITE_HERO_IMAGE}
      />
      <Container>
        <Box sx={{my: 2}}>
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
