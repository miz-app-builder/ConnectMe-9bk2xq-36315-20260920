import { useState, useEffect, useCallback } from 'react';
import { getContacts, addContact, removeContact } from '@/services/contactService';
import { searchProfiles } from '@/services/profileService';
import { Contact, UserProfile } from '@/types';
import { useAuth } from '@/template';

export function useContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    if (!user?.id) return;
    const { data, error: err } = await getContacts(user.id);
    if (!err) setContacts(data);
    else setError(err);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const search = useCallback(async (query: string) => {
    if (!user?.id || !query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await searchProfiles(query, user.id);
    setSearchResults(data);
    setSearching(false);
  }, [user?.id]);

  const add = useCallback(async (contactId: string) => {
    if (!user?.id) return { error: 'Not logged in' };
    const { error: err } = await addContact(user.id, contactId);
    if (!err) fetchContacts();
    return { error: err };
  }, [user?.id, fetchContacts]);

  const remove = useCallback(async (contactId: string) => {
    if (!user?.id) return { error: 'Not logged in' };
    const { error: err } = await removeContact(user.id, contactId);
    if (!err) setContacts(prev => prev.filter(c => c.contact_id !== contactId));
    return { error: err };
  }, [user?.id]);

  const isInContacts = useCallback((profileId: string) => {
    return contacts.some(c => c.contact_id === profileId);
  }, [contacts]);

  return {
    contacts,
    searchResults,
    loading,
    searching,
    error,
    search,
    add,
    remove,
    isInContacts,
    refresh: fetchContacts,
    clearSearch: () => setSearchResults([]),
  };
}
