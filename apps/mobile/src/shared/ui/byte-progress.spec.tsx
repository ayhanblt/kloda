import { render } from '@testing-library/react-native';
import { ByteProgress } from './byte-progress';

it.each([[-2, 0], [0, 0], [50.9, 50], [99, 99], [100, 100], [102, 100]])(
  'keeps accessible progress and finite Tailwind width in agreement for %s', async (percent, expected) => {
    const screen = await render(<ByteProgress label="progress fixture" percent={percent} />);
    const progress = screen.getByRole('progressbar');
    expect(progress.props.accessibilityValue).toEqual({ min: 0, max: 100, now: expected });
    expect(progress.props.children.props.className).toContain(`w-[${expected}%]`);
    await screen.unmount();
  },
);
