import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { columnSides, columnSurface, type ColumnSides, type ColumnSurface } from '../theme/column';

/** The space either side of the content column in this window, as it is now; see `COLUMN_MAX_WIDTH`. */
export function useColumnSides(): ColumnSides {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return columnSides(width, insets);
}

/** A sheet's surface as the column, in this window, as it is now. */
export function useColumnSurface(drawn: number): ColumnSurface {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return columnSurface(width, insets, drawn);
}
