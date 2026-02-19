import React, { useContext } from 'react';
import { createPortal } from 'react-dom';
import { TransitionGroup } from 'react-transition-group';
import useNuiEvent from '../../hooks/useNuiEvent';
import useQueue from '../../hooks/useQueue';
import { Locale } from '../../store/locale';
import { getItemUrl } from '../../helpers';
import { SlotWithItem } from '../../typings';
import { Items } from '../../store/items';
import Fade from './transitions/Fade';

// Item yang tidak perlu muncul di notifikasi
const HIDDEN_NOTIFICATION_ITEMS = ['clothing_reserved'];

interface ItemNotificationProps {
  item: SlotWithItem;
  text: string;
}

export const ItemNotificationsContext = React.createContext<{
  add: (item: ItemNotificationProps) => void;
} | null>(null);

export const useItemNotifications = () => {
  const ctx = useContext(ItemNotificationsContext);
  if (!ctx) throw new Error(`ItemNotificationsContext undefined`);
  return ctx;
};

const ItemNotification = React.forwardRef(
  (props: { item: ItemNotificationProps; style?: React.CSSProperties }, ref: React.ForwardedRef<HTMLDivElement>) => {
    const slotItem = props.item.item;
    return (
      <div
        className="item-notification-item-box"
        style={{ backgroundImage: `url(${getItemUrl(slotItem) || 'none'}`, ...props.style }}
        ref={ref}
      >
        <div className="item-slot-wrapper">
          <div className="item-notification-action-box">
            <p>{props.item.text}</p>
          </div>
          <div className="inventory-slot-label-box">
            <div className="inventory-slot-label-text">{slotItem.metadata?.label || Items[slotItem.name]?.label}</div>
          </div>
        </div>
      </div>
    );
  }
);

export const ItemNotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const queue = useQueue<{ id: number; item: ItemNotificationProps; ref: React.RefObject<HTMLDivElement> }>();

  const add = (item: ItemNotificationProps) => {
    const ref = React.createRef<HTMLDivElement>();
    queue.add({ id: Date.now(), item, ref });
    const timeout = setTimeout(() => { queue.remove(); clearTimeout(timeout); }, 2500);
  };

  useNuiEvent<[item: SlotWithItem, text: string, count?: number]>('itemNotify', ([item, text, count]) => {
    // Jangan tampilkan notifikasi untuk item reserved/placeholder
    if (HIDDEN_NOTIFICATION_ITEMS.includes(item?.name)) return;

    add({ item, text: count ? `${Locale[text]} ${count}x` : `${Locale[text]}` });
  });

  return (
    <ItemNotificationsContext.Provider value={{ add }}>
      {children}
      {createPortal(
        <TransitionGroup className="item-notification-container">
          {queue.values.map((notification, index) => (
            <Fade key={`item-notification-${index}`}>
              <ItemNotification item={notification.item} ref={notification.ref} />
            </Fade>
          ))}
        </TransitionGroup>,
        document.body
      )}
    </ItemNotificationsContext.Provider>
  );
};