import { fireEvent, render } from '@testing-library/react-native';
import { BusPopup } from '../../../../src/features/map/components/overlays/BusPopup';
import type { BusMarker } from '../../../../src/features/map/hooks/useLiveMap';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

function marker(headcount: number | null | undefined): BusMarker {
  return {
    bus: { id: 'bus-17a', line: '17', destination: 'Centru', crowd: 2, delayMin: 0, delayReason: null, headcount },
    position: {
      busId: 'bus-17a',
      lat: 45.7645,
      lng: 21.2315,
      nextStop: 'Piața Mărăști',
      arrivesInMin: 2,
      updatedAt: '2026-10-03T09:00:00Z',
    },
  };
}

function renderPopup(headcount: number | null | undefined) {
  const onClose = jest.fn();
  const utils = render(
    <BusPopup anchored marker={marker(headcount)} tracked={false} onTrack={jest.fn()} onClose={onClose} />,
  );
  return { ...utils, onClose };
}

describe('BusPopup', () => {
  it('arată câte persoane sunt în vehicul', () => {
    const { getByTestId } = renderPopup(34);
    expect(getByTestId('bus-headcount').props.children).toBe('34 persoane în vehicul');
  });

  it('folosește singularul pentru o singură persoană', () => {
    const { getByTestId } = renderPopup(1);
    expect(getByTestId('bus-headcount').props.children).toBe('1 persoană în vehicul');
  });

  it('spune că numărul e indisponibil când lipsește', () => {
    expect(renderPopup(null).getByTestId('bus-headcount').props.children).toBe('Număr de persoane indisponibil');
    expect(renderPopup(undefined).getByTestId('bus-headcount').props.children).toBe('Număr de persoane indisponibil');
  });

  it('arată stația curentă și se închide la apăsare pe ×', () => {
    const { getByText, getByLabelText, onClose } = renderPopup(5);
    expect(getByText(/Piața Mărăști/)).toBeTruthy();
    fireEvent.press(getByLabelText('Închide'));
    expect(onClose).toHaveBeenCalled();
  });
});
