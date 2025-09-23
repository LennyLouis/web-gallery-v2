import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Badge, Navbar, Nav, Dropdown, Spinner, Form, Modal, Tab, Tabs } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '~/contexts/AuthContext';
import { api, type Album, type Photo, type UserAlbumPermission } from '~/lib/supabase';
import type { Route } from './+types/admin.album.$id';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Gestion Album - Les photos de Lenny' },
    { name: 'description', content: 'Gestion d\'album administrateur' },
  ];
}

export default function AdminAlbumPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, session, logout, loading: authLoading, isSessionValid } = useAuth();
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [accessLinks, setAccessLinks] = useState<any[]>([]);
  const [albumUsers, setAlbumUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [albumPermissions, setAlbumPermissions] = useState<UserAlbumPermission[]>([]);

  // Form states
  const [albumForm, setAlbumForm] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    tags: '',
    is_public: false
  });

  // Modal states
  const [showCreateLinkModal, setShowCreateLinkModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGrantPermissionModal, setShowGrantPermissionModal] = useState(false);
  const [showInviteWithPermissionModal, setShowInviteWithPermissionModal] = useState(false);
  const [showEditPermissionModal, setShowEditPermissionModal] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<UserAlbumPermission | null>(null);

  // Form for new access link
  const [linkForm, setLinkForm] = useState({
    expires_at: '',
    max_uses: '',
    permission_type: 'view' as 'view' | 'download'
  });

  // Form for inviting user
  const [inviteForm, setInviteForm] = useState({
    email: ''
  });

  // Forms for permission management
  const [permissionForm, setPermissionForm] = useState({
    user_email: '',
    permission_type: 'view' as 'view' | 'download' | 'manage',
    expires_at: ''
  });

  const [invitePermissionForm, setInvitePermissionForm] = useState({
    email: '',
    permission_type: 'view' as 'view' | 'download' | 'manage',
    expires_at: ''
  });

  // Photo upload states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Redirection si pas admin ou session invalide
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin' || !isSessionValid())) {
      navigate('/admin');
    }
  }, [user, authLoading, isSessionValid, navigate]);

  // Charger l'album et les photos
  useEffect(() => {
    if (user && user.role === 'admin' && isSessionValid() && id) {
      loadAlbumData();
    }
  }, [user, id]); // Removed isSessionValid dependency to avoid loops

  // Charger les données d'accès quand on change d'onglet
  useEffect(() => {
    if (user && user.role === 'admin' && album?.id && (activeTab === 'access' || activeTab === 'permissions')) {
      loadAccessData();
    }
  }, [user, album?.id, activeTab]); // Removed isSessionValid dependency to avoid loops

  const loadAlbumData = async () => {
    if (!id || !session || !isSessionValid()) {
      console.error('Cannot load album data: missing valid session');
      setError('Session expirée, veuillez vous reconnecter');
      return;
    }

    if (isLoadingData) {
      return;
    }

    try {
      setIsLoadingData(true);
      setLoading(true);

      const [albumResult, photosResult] = await Promise.all([
        api.getAlbum(id),
        api.getPhotos(id)
      ]);

      setAlbum(albumResult.album);
      setPhotos(photosResult.photos || []);

      // Remplir le formulaire avec les données de l'album
      if (albumResult.album) {
        setAlbumForm({
          title: albumResult.album.title || '',
          description: albumResult.album.description || '',
          date: albumResult.album.date ? albumResult.album.date.split('T')[0] : '',
          location: albumResult.album.location || '',
          tags: albumResult.album.tags ? albumResult.album.tags.join(', ') : '',
          is_public: albumResult.album.is_public || false
        });
      }
    } catch (err) {
      setError('Erreur lors du chargement de l\'album');
      console.error('Load album error:', err);
    } finally {
      setLoading(false);
      setIsLoadingData(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleFormChange = (field: string, value: any) => {
    setAlbumForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveAlbum = async () => {
    if (!album?.id) return;

    try {
      setLoading(true);

      const albumData = {
        title: albumForm.title,
        description: albumForm.description || undefined,
        date: albumForm.date || undefined,
        location: albumForm.location || undefined,
        tags: albumForm.tags ? albumForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : undefined,
        is_public: albumForm.is_public
      };

      const result = await api.updateAlbum(album.id, albumData);
      setAlbum(result.album);

      // Show success message (you could add a toast notification here)
      alert('Album mis à jour avec succès !');

    } catch (err) {
      console.error('Update album error:', err);
      alert('Erreur lors de la mise à jour de l\'album');
    } finally {
      setLoading(false);
    }
  };

  const loadAccessData = async () => {
    if (!album?.id || !session || !isSessionValid()) {
      console.error('Cannot load access data: missing valid session');
      return;
    }

    try {

      const [linksResult, usersResult, allUsersResult, permissionsResult] = await Promise.all([
        api.getAlbumAccessLinks(album.id),
        api.getAlbumUsers(album.id),
        api.getUsers(),
        api.getAlbumPermissions(album.id)
      ]);

      setAccessLinks(linksResult.access_links || []);
      setAlbumUsers(usersResult.users || []);
      setAllUsers(allUsersResult.users || []);
      setAlbumPermissions(permissionsResult.permissions || []);
    } catch (err) {
      console.error('Load access data error:', err);
    }
  };

  const handleCreateAccessLink = async () => {
    if (!album?.id) return;

    try {
      const expiresAt = linkForm.expires_at || undefined;
      const maxUses = linkForm.max_uses ? parseInt(linkForm.max_uses) : undefined;

      await api.createAccessLink(album.id, expiresAt, maxUses, linkForm.permission_type);
      await loadAccessData();
      setShowCreateLinkModal(false);
      setLinkForm({ expires_at: '', max_uses: '', permission_type: 'view' });
    } catch (err) {
      console.error('Create access link error:', err);
      alert('Erreur lors de la création du lien d\'accès');
    }
  };

  const handleDeleteAccessLink = async (linkId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce lien d\'accès ?')) return;

    try {
      await api.deleteAccessLink(linkId);
      await loadAccessData();
    } catch (err) {
      console.error('Delete access link error:', err);
      alert('Erreur lors de la suppression du lien d\'accès');
    }
  };

  const handleInviteUser = async () => {
    if (!album?.id || !inviteForm.email) return;

    try {
      await api.inviteUserByEmail(album.id, inviteForm.email);
      await loadAccessData();
      setShowInviteModal(false);
      setInviteForm({ email: '' });
      alert('Invitation envoyée avec succès !');
    } catch (err) {
      console.error('Invite user error:', err);
      alert('Erreur lors de l\'invitation de l\'utilisateur');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!album?.id || !confirm('Êtes-vous sûr de vouloir retirer l\'accès à cet utilisateur ?')) return;

    try {
      await api.removeUserFromAlbum(album.id, userId);
      await loadAccessData();
    } catch (err) {
      console.error('Remove user error:', err);
      alert('Erreur lors de la suppression de l\'accès utilisateur');
    }
  };

  const handlePhotoUpload = async (files: FileList) => {
    if (!album?.id || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const result = await api.uploadPhotos(album.id, files);
      await loadAlbumData(); // Reload photos
      alert(`${result.photos.length} photo(s) uploadée(s) avec succès !`);
    } catch (err) {
      console.error('Upload photos error:', err);
      alert('Erreur lors de l\'upload des photos');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette photo ?')) return;

    try {
      await api.deletePhoto(photoId);
      await loadAlbumData(); // Reload photos
    } catch (err) {
      console.error('Delete photo error:', err);
      alert('Erreur lors de la suppression de la photo');
    }
  };

  const handleSetCoverPhoto = async (photoId: string) => {
    if (!album?.id) return;

    try {
      const result = await api.setCoverPhoto(album.id, photoId);
      setAlbum(result.album);
      alert('Photo de couverture définie avec succès !');
    } catch (err) {
      console.error('Set cover photo error:', err);
      alert('Erreur lors de la définition de la photo de couverture');
    }
  };

  // Permission management handlers
  const handleGrantPermission = async () => {
    if (!album?.id || !permissionForm.user_email) return;

    try {
      await api.grantPermission(
        permissionForm.user_email,
        album.id,
        permissionForm.permission_type,
        permissionForm.expires_at || undefined
      );
      await loadAccessData();
      setShowGrantPermissionModal(false);
      setPermissionForm({ user_email: '', permission_type: 'view', expires_at: '' });
      alert('Permission accordée avec succès !');
    } catch (err) {
      console.error('Grant permission error:', err);
      alert('Erreur lors de l\'attribution de la permission');
    }
  };

  const handleInviteWithPermission = async () => {
    if (!album?.id || !invitePermissionForm.email) return;

    try {
      await api.inviteUserWithPermission(
        invitePermissionForm.email,
        album.id,
        invitePermissionForm.permission_type,
        invitePermissionForm.expires_at || undefined
      );
      await loadAccessData();
      setShowInviteWithPermissionModal(false);
      setInvitePermissionForm({ email: '', permission_type: 'view', expires_at: '' });
      alert('Utilisateur invité avec succès !');
    } catch (err) {
      console.error('Invite with permission error:', err);
      alert('Erreur lors de l\'invitation');
    }
  };

  const handleEditPermission = (permission: UserAlbumPermission) => {
    setSelectedPermission(permission);
    setShowEditPermissionModal(true);
  };

  const handleUpdatePermission = async () => {
    if (!selectedPermission) return;

    try {
      await api.updatePermission(selectedPermission.id, {
        permission_type: selectedPermission.permission_type,
        expires_at: selectedPermission.expires_at,
        is_active: selectedPermission.is_active
      });
      await loadAccessData();
      setShowEditPermissionModal(false);
      setSelectedPermission(null);
      alert('Permission mise à jour avec succès !');
    } catch (err) {
      console.error('Update permission error:', err);
      alert('Erreur lors de la mise à jour de la permission');
    }
  };

  const handleDeletePermission = async (permissionId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette permission ?')) return;

    try {
      await api.deletePermission(permissionId);
      await loadAccessData();
      alert('Permission supprimée avec succès !');
    } catch (err) {
      console.error('Delete permission error:', err);
      alert('Erreur lors de la suppression de la permission');
    }
  };

  const getPermissionBadgeColor = (permissionType: string) => {
    switch (permissionType) {
      case 'view': return 'info';
      case 'download': return 'success';
      case 'manage': return 'warning';
      default: return 'secondary';
    }
  };

  const getPermissionIcon = (permissionType: string) => {
    switch (permissionType) {
      case 'view': return '👁️';
      case 'download': return '📥';
      case 'manage': return '⚙️';
      default: return '👤';
    }
  };

  // Affichage pendant chargement auth
  if (authLoading) {
    return (
      <div className="web-gallery">
        <Container className="py-5">
          <div className="text-center">
            <Spinner animation="border" style={{color: 'var(--bs-primary)'}} />
            <p className="mt-3 text-muted">Chargement...</p>
          </div>
        </Container>
      </div>
    );
  }

  // Redirection si pas admin
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="web-gallery">
      {/* Navigation */}
      <Navbar expand="lg" className="bg-white shadow-sm">
        <Container>
          <Navbar.Brand as={Link} to="/dashboard" className="fw-bold d-flex align-items-center" style={{color: 'var(--bs-primary)'}}>
            <img src="/logo-transparent-256x256.png" alt="Logo" width="32" height="32" className="me-2" />
            Les photos de Lenny - Administration
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/dashboard" style={{color: 'var(--bs-primary)'}}>📸 Albums</Nav.Link>
              <Nav.Link as={Link} to="/admin" style={{color: 'var(--bs-primary)'}}>⚙️ Administration</Nav.Link>
            </Nav>
            <Nav>
              <Dropdown align="end">
                <Dropdown.Toggle variant="link" className="text-decoration-none d-flex align-items-center" style={{color: 'var(--bs-primary)'}}>
                  <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2"
                       style={{width: '32px', height: '32px', fontSize: '14px'}}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="fw-medium">{user.name}</span>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item as={Link} to="/dashboard">📸 Albums</Dropdown.Item>
                  <Dropdown.Item as={Link} to="/admin">⚙️ Administration</Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={handleLogout}>Logout</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* Main Content */}
      <Container className="py-4">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" style={{color: 'var(--bs-primary)'}} />
            <p className="mt-3 text-muted">Chargement de l'album...</p>
          </div>
        ) : error ? (
          <div className="text-center py-5">
            <div className="fs-1 text-muted mb-3">⚠️</div>
            <h4 className="h5 text-muted mb-2">Erreur</h4>
            <p className="text-muted mb-4">{error}</p>
            <Button variant="primary" onClick={loadAlbumData}>
              Réessayer
            </Button>
          </div>
        ) : !album ? (
          <div className="text-center py-5">
            <div className="fs-1 text-muted mb-3">📁</div>
            <h4 className="h5 text-muted mb-2">Album non trouvé</h4>
            <p className="text-muted mb-4">Cet album n'existe pas ou vous n'avez pas les permissions pour y accéder.</p>
            <Button as={Link} to="/admin" variant="primary">
              ← Retour à l'administration
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <Row className="mb-4">
              <Col>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <nav aria-label="breadcrumb">
                      <ol className="breadcrumb">
                        <li className="breadcrumb-item">
                          <Link to="/admin" style={{color: 'var(--bs-primary)'}}>Administration</Link>
                        </li>
                        <li className="breadcrumb-item active" aria-current="page">
                          {album.title}
                        </li>
                      </ol>
                    </nav>
                    <h1 className="h2 fw-bold mb-2" style={{color: 'var(--bs-primary)'}}>
                      Gestion de l'Album: {album.title} 📁
                    </h1>
                    <div className="d-flex gap-2 mb-0">
                      <Badge bg={album.is_public ? 'success' : 'secondary'}>
                        {album.is_public ? '🌐 Public' : '🔒 Privé'}
                      </Badge>
                      <Badge bg="light" text="dark">
                        {photos.length} photo{photos.length > 1 ? 's' : ''}
                      </Badge>
                      {album.date && (
                        <Badge bg="light" text="dark">
                          📅 {new Date(album.date).toLocaleDateString('fr-FR')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <Button
                      variant="outline-danger"
                      className="me-2"
                      onClick={async () => {
                        if (confirm('Êtes-vous sûr de vouloir supprimer cet album ? Cette action est irréversible.')) {
                          try {
                            if (!album?.id) return;
                            await api.deleteAlbum(album.id);
                            alert('Album supprimé avec succès !');
                            navigate('/admin');
                          } catch (err) {
                            console.error('Delete album error:', err);
                            alert('Erreur lors de la suppression de l\'album');
                          }
                        }
                      }}
                    >
                      🗑️ Supprimer
                    </Button>
                    <Button
                      as={Link}
                      to={`/album/${album.id}`}
                      className="btn-clean-primary"
                    >
                      👁️ Prévisualiser
                    </Button>
                  </div>
                </div>
              </Col>
            </Row>

            {/* Tabs */}
            <Row>
              <Col>
                <Card className="card-clean">
                  <Tabs
                    activeKey={activeTab}
                    onSelect={(k) => setActiveTab(k || 'info')}
                    className="px-3 pt-3"
                  >
                    {/* Informations Tab */}
                    <Tab eventKey="info" title="📝 Informations">
                      <Card.Body>
                        <Form>
                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label className="form-label-clean">Titre de l'album *</Form.Label>
                                <Form.Control
                                  type="text"
                                  className="form-control-clean"
                                  value={albumForm.title}
                                  onChange={(e) => handleFormChange('title', e.target.value)}
                                  placeholder="Entrez le titre de l'album"
                                  required
                                />
                              </Form.Group>
                            </Col>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label className="form-label-clean">Date de l'évènement</Form.Label>
                                <Form.Control
                                  type="date"
                                  className="form-control-clean"
                                  value={albumForm.date}
                                  onChange={(e) => handleFormChange('date', e.target.value)}
                                />
                              </Form.Group>
                            </Col>
                          </Row>

                          <Form.Group className="mb-3">
                            <Form.Label className="form-label-clean">Description</Form.Label>
                            <Form.Control
                              as="textarea"
                              rows={3}
                              className="form-control-clean"
                              value={albumForm.description}
                              onChange={(e) => handleFormChange('description', e.target.value)}
                              placeholder="Description de l'album..."
                            />
                          </Form.Group>

                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label className="form-label-clean">Lieu</Form.Label>
                                <Form.Control
                                  type="text"
                                  className="form-control-clean"
                                  value={albumForm.location}
                                  onChange={(e) => handleFormChange('location', e.target.value)}
                                  placeholder="Lieu de l'évènement"
                                />
                              </Form.Group>
                            </Col>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label className="form-label-clean">Tags</Form.Label>
                                <Form.Control
                                  type="text"
                                  className="form-control-clean"
                                  value={albumForm.tags}
                                  onChange={(e) => handleFormChange('tags', e.target.value)}
                                  placeholder="mariage, famille, extérieur..."
                                />
                                <Form.Text className="text-muted">
                                  Séparez les tags par des virgules
                                </Form.Text>
                              </Form.Group>
                            </Col>
                          </Row>

                          <Form.Group className="mb-4">
                            <Form.Check
                              type="checkbox"
                              label="🌐 Album public (visible sur le site)"
                              checked={albumForm.is_public}
                              onChange={(e) => handleFormChange('is_public', e.target.checked)}
                            />
                          </Form.Group>

                          <div className="d-flex gap-2">
                            <Button
                              className="btn-clean-primary"
                              onClick={handleSaveAlbum}
                            >
                              💾 Enregistrer les modifications
                            </Button>
                            <Button
                              variant="outline-secondary"
                              onClick={loadAlbumData}
                            >
                              ↶ Annuler
                            </Button>
                          </div>
                        </Form>
                      </Card.Body>
                    </Tab>

                    {/* Access Tab */}
                    <Tab eventKey="access" title="🔗 Accès">
                      <Card.Body>
                        <div className="mb-4">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h5 className="mb-0 fw-bold" style={{color: 'var(--bs-primary)'}}>
                              Liens d'accès 🔗
                            </h5>
                            <Button
                              className="btn-clean-primary"
                              size="sm"
                              onClick={() => setShowCreateLinkModal(true)}
                            >
                              ➕ Créer un lien
                            </Button>
                          </div>

                          <Card className="card-clean">
                            <Card.Body className="p-0">
                              {accessLinks.length === 0 ? (
                                <div className="text-center py-4">
                                  <div className="fs-3 text-muted mb-3">🔗</div>
                                  <h6 className="h6 text-muted mb-2">Aucun lien d'accès</h6>
                                  <p className="text-muted mb-3">Créez des liens sécurisés pour donner accès à cet album.</p>
                                  <Button
                                    className="btn-clean-primary"
                                    size="sm"
                                    onClick={() => setShowCreateLinkModal(true)}
                                  >
                                    Créer le premier lien
                                  </Button>
                                </div>
                              ) : (
                                <Table hover className="mb-0">
                                  <thead className="bg-light">
                                    <tr>
                                      <th className="border-0 fw-bold">Lien</th>
                                      <th className="border-0 fw-bold">Permission</th>
                                      <th className="border-0 fw-bold">Utilisation</th>
                                      <th className="border-0 fw-bold">Expiration</th>
                                      <th className="border-0 fw-bold">Statut</th>
                                      <th className="border-0 fw-bold text-end">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {accessLinks.map((link) => (
                                      <tr key={link.id}>
                                        <td className="py-3">
                                          <div className="d-flex align-items-center">
                                            <code className="bg-light px-2 py-1 rounded text-truncate" style={{maxWidth: '200px'}}>
                                              ...{link.token.substring(link.token.length - 8)}
                                            </code>
                                            <Button
                                              variant="outline-secondary"
                                              size="sm"
                                              className="ms-2"
                                              onClick={() => {
                                                const url = `${window.location.origin}/album/${album.id}?token=${link.token}`;
                                                navigator.clipboard.writeText(url);
                                                alert('Lien copié dans le presse-papiers !');
                                              }}
                                            >
                                              📋
                                            </Button>
                                          </div>
                                        </td>
                                        <td className="py-3">
                                          <Badge bg={link.permission_type === 'download' ? 'primary' : 'secondary'}>
                                            {link.permission_type === 'download' ? '⬇️ Téléchargement' : '👀 Visualisation'}
                                          </Badge>
                                        </td>
                                        <td className="py-3">
                                          <span className="text-muted">
                                            {link.uses_count}{link.max_uses ? `/${link.max_uses}` : ''}
                                          </span>
                                        </td>
                                        <td className="py-3">
                                          {link.expires_at ? (
                                            <span className="text-muted">
                                              {new Date(link.expires_at).toLocaleDateString('fr-FR')}
                                            </span>
                                          ) : (
                                            <span className="text-muted">Jamais</span>
                                          )}
                                        </td>
                                        <td className="py-3">
                                          <Badge bg={link.is_active ? 'success' : 'secondary'}>
                                            {link.is_active ? 'Actif' : 'Inactif'}
                                          </Badge>
                                        </td>
                                        <td className="py-3 text-end">
                                          <Button
                                            variant="outline-danger"
                                            size="sm"
                                            onClick={() => handleDeleteAccessLink(link.id)}
                                          >
                                            🗑️
                                          </Button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </Table>
                              )}
                            </Card.Body>
                          </Card>
                        </div>

                        <div>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h5 className="mb-0 fw-bold" style={{color: 'var(--bs-primary)'}}>
                              Utilisateurs avec accès 👥
                            </h5>
                            <Button
                              className="btn-clean-primary"
                              size="sm"
                              onClick={() => setShowInviteModal(true)}
                            >
                              ➕ Inviter par email
                            </Button>
                          </div>

                          <Card className="card-clean">
                            <Card.Body className="p-0">
                              {albumUsers.length === 0 ? (
                                <div className="text-center py-4">
                                  <div className="fs-3 text-muted mb-3">👥</div>
                                  <h6 className="h6 text-muted mb-2">Aucun utilisateur assigné</h6>
                                  <p className="text-muted mb-3">Ajoutez des utilisateurs pour leur donner accès à cet album.</p>
                                  <Button
                                    className="btn-clean-primary"
                                    size="sm"
                                    onClick={() => setShowInviteModal(true)}
                                  >
                                    Inviter le premier utilisateur
                                  </Button>
                                </div>
                              ) : (
                                <Table hover className="mb-0">
                                  <thead className="bg-light">
                                    <tr>
                                      <th className="border-0 fw-bold">Utilisateur</th>
                                      <th className="border-0 fw-bold">Email</th>
                                      <th className="border-0 fw-bold">Rôle</th>
                                      <th className="border-0 fw-bold text-end">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {albumUsers.map((user) => (
                                      <tr key={user.id}>
                                        <td className="py-3">
                                          <div className="d-flex align-items-center">
                                            <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2"
                                                 style={{width: '32px', height: '32px', fontSize: '14px'}}>
                                              {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="fw-medium">{user.name}</span>
                                          </div>
                                        </td>
                                        <td className="py-3">
                                          <span className="text-muted">{user.email}</span>
                                        </td>
                                        <td className="py-3">
                                          <Badge bg={user.role === 'admin' ? 'primary' : 'secondary'}>
                                            {user.role === 'admin' ? '👑 Admin' : '👤 Utilisateur'}
                                          </Badge>
                                        </td>
                                        <td className="py-3 text-end">
                                          {user.role !== 'admin' && (
                                            <Button
                                              variant="outline-danger"
                                              size="sm"
                                              onClick={() => handleRemoveUser(user.id)}
                                            >
                                              🗑️ Retirer
                                            </Button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </Table>
                              )}
                            </Card.Body>
                          </Card>
                        </div>
                      </Card.Body>
                    </Tab>

                    {/* Permissions Tab */}
                    <Tab eventKey="permissions" title="🔐 Permissions">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-center mb-4">
                          <h5 className="mb-0 fw-bold" style={{color: 'var(--bs-primary)'}}>
                            Gestion des Permissions 🔐
                          </h5>
                          <div className="d-flex gap-2">
                            <Button
                              className="btn-clean-primary"
                              size="sm"
                              onClick={() => setShowGrantPermissionModal(true)}
                            >
                              👤 Accorder Permission
                            </Button>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => setShowInviteWithPermissionModal(true)}
                            >
                              📧 Inviter Utilisateur
                            </Button>
                          </div>
                        </div>

                        <Card className="card-clean">
                          <Card.Body className="p-0">
                            {albumPermissions.length === 0 ? (
                              <div className="text-center py-5">
                                <div className="fs-1 text-muted mb-3">🔐</div>
                                <h4 className="h5 text-muted mb-2">Aucune permission accordée</h4>
                                <p className="text-muted mb-4">Accordez des permissions spécifiques aux utilisateurs pour cet album.</p>
                                <div className="d-flex gap-2 justify-content-center">
                                  <Button
                                    className="btn-clean-primary"
                                    onClick={() => setShowGrantPermissionModal(true)}
                                  >
                                    👤 Première Permission
                                  </Button>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => setShowInviteWithPermissionModal(true)}
                                  >
                                    📧 Inviter par Email
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="table-responsive">
                                <Table hover className="mb-0">
                                  <thead className="bg-light">
                                    <tr>
                                      <th className="border-0 fw-bold">Utilisateur</th>
                                      <th className="border-0 fw-bold">Permission</th>
                                      <th className="border-0 fw-bold">Expiration</th>
                                      <th className="border-0 fw-bold">Statut</th>
                                      <th className="border-0 fw-bold">Accordée le</th>
                                      <th className="border-0 fw-bold text-end">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {albumPermissions.map((permission) => (
                                      <tr key={permission.id}>
                                        <td className="py-3">
                                          <div className="d-flex align-items-center">
                                            <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2"
                                                 style={{width: '32px', height: '32px', fontSize: '14px'}}>
                                              {permission.user_email?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            <div>
                                              <div className="fw-medium">{permission.user_name || permission.user_email}</div>
                                              {permission.user_email && (
                                                <small className="text-muted">{permission.user_email}</small>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3">
                                          <Badge bg={getPermissionBadgeColor(permission.permission_type)}>
                                            {getPermissionIcon(permission.permission_type)} {permission.permission_type.charAt(0).toUpperCase() + permission.permission_type.slice(1)}
                                          </Badge>
                                        </td>
                                        <td className="py-3">
                                          {permission.expires_at ? (
                                            <span className="text-muted">
                                              {new Date(permission.expires_at).toLocaleDateString('fr-FR')}
                                            </span>
                                          ) : (
                                            <span className="text-muted">Jamais</span>
                                          )}
                                        </td>
                                        <td className="py-3">
                                          <Badge bg={permission.is_active && (permission.is_valid ?? true) ? 'success' : 'secondary'}>
                                            {permission.is_active && (permission.is_valid ?? true) ? 'Actif' : 'Inactif'}
                                          </Badge>
                                        </td>
                                        <td className="py-3">
                                          <span className="text-muted">
                                            {new Date(permission.created_at).toLocaleDateString('fr-FR')}
                                          </span>
                                        </td>
                                        <td className="py-3 text-end">
                                          <div className="d-flex gap-1 justify-content-end">
                                            <Button
                                              variant="outline-primary"
                                              size="sm"
                                              onClick={() => handleEditPermission(permission)}
                                              title="Modifier"
                                            >
                                              ✏️
                                            </Button>
                                            <Button
                                              variant="outline-danger"
                                              size="sm"
                                              onClick={() => handleDeletePermission(permission.id)}
                                              title="Supprimer"
                                            >
                                              🗑️
                                            </Button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </Table>
                              </div>
                            )}
                          </Card.Body>
                        </Card>

                        <div className="mt-4">
                          <h6 className="fw-bold mb-3" style={{color: 'var(--bs-primary)'}}>
                            ℹ️ Types de Permissions
                          </h6>
                          <div className="row g-3">
                            <div className="col-md-4">
                              <div className="d-flex align-items-center">
                                <Badge bg="info" className="me-2">👁️ View</Badge>
                                <small className="text-muted">Peut voir l'album et les photos</small>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="d-flex align-items-center">
                                <Badge bg="success" className="me-2">📥 Download</Badge>
                                <small className="text-muted">Peut voir et télécharger les photos</small>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="d-flex align-items-center">
                                <Badge bg="warning" className="me-2">⚙️ Manage</Badge>
                                <small className="text-muted">Peut tout faire sauf supprimer l'album</small>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card.Body>
                    </Tab>

                    {/* Photos Tab */}
                    <Tab eventKey="photos" title="📸 Photos">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-center mb-4">
                          <h5 className="mb-0 fw-bold" style={{color: 'var(--bs-primary)'}}>
                            Photos de l'album ({photos.length})
                          </h5>
                          <div className="d-flex gap-2">
                            <div className="position-relative">
                              <input
                                type="file"
                                multiple
                                accept="image/*,.zip"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    handlePhotoUpload(e.target.files);
                                  }
                                }}
                                className="position-absolute opacity-0 w-100 h-100"
                                style={{ cursor: 'pointer' }}
                                disabled={uploading}
                              />
                              <Button className="btn-clean-primary" disabled={uploading}>
                                {uploading ? (
                                  <>
                                    <Spinner animation="border" size="sm" className="me-2" />
                                    Upload en cours...
                                  </>
                                ) : (
                                  '📁 Upload Photos/ZIP'
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {uploading && (
                          <div className="mb-4">
                            <div className="progress" style={{ height: '8px' }}>
                              <div
                                className="progress-bar"
                                role="progressbar"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                            <small className="text-muted">Upload en cours...</small>
                          </div>
                        )}

                        {photos.length === 0 ? (
                          <div className="text-center py-5">
                            <div className="fs-1 text-muted mb-3">📸</div>
                            <h4 className="h5 text-muted mb-2">Aucune photo</h4>
                            <p className="text-muted mb-4">Commencez par ajouter des photos à cet album.</p>
                            <div className="position-relative d-inline-block">
                              <input
                                type="file"
                                multiple
                                accept="image/*,.zip"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    handlePhotoUpload(e.target.files);
                                  }
                                }}
                                className="position-absolute opacity-0 w-100 h-100"
                                style={{ cursor: 'pointer' }}
                                disabled={uploading}
                              />
                              <Button className="btn-clean-primary" disabled={uploading}>
                                📁 Upload Photos/ZIP
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="photo-grid">
                            {photos.map((photo) => (
                              <div key={photo.id} className="photo-card">
                                <img
                                  src={photo.preview_url || photo.preview_path}
                                  alt={photo.original_name}
                                  loading="lazy"
                                />
                                <div className="position-absolute top-0 end-0 m-2">
                                  <Dropdown>
                                    <Dropdown.Toggle variant="light" size="sm">
                                      ⚙️
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu>
                                      <Dropdown.Item onClick={() => {
                                        // TODO: Implement photo modal view
                                        window.open(photo.download_url || photo.file_path, '_blank');
                                      }}>
                                        👁️ Voir en grand
                                      </Dropdown.Item>
                                      <Dropdown.Item onClick={() => handleSetCoverPhoto(photo.id)}>
                                        📋 Définir comme couverture
                                      </Dropdown.Item>
                                      <Dropdown.Divider />
                                      <Dropdown.Item
                                        className="text-danger"
                                        onClick={() => handleDeletePhoto(photo.id)}
                                      >
                                        🗑️ Supprimer
                                      </Dropdown.Item>
                                    </Dropdown.Menu>
                                  </Dropdown>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card.Body>
                    </Tab>
                  </Tabs>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Container>

      {/* Create Access Link Modal */}
      <Modal show={showCreateLinkModal} onHide={() => setShowCreateLinkModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Créer un lien d'accès</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Type de permission</Form.Label>
              <Form.Select
                value={linkForm.permission_type}
                onChange={(e) => setLinkForm({...linkForm, permission_type: e.target.value as 'view' | 'download'})}
              >
                <option value="view">👀 Visualisation uniquement</option>
                <option value="download">⬇️ Visualisation et téléchargement</option>
              </Form.Select>
              <Form.Text className="text-muted">
                Les liens de visualisation permettent seulement de voir les photos. Les liens de téléchargement permettent aussi de les télécharger.
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Date d'expiration (optionnelle)</Form.Label>
              <Form.Control
                type="datetime-local"
                value={linkForm.expires_at}
                onChange={(e) => setLinkForm({...linkForm, expires_at: e.target.value})}
              />
              <Form.Text className="text-muted">
                Laissez vide pour un lien sans expiration
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Nombre d'utilisations max (optionnel)</Form.Label>
              <Form.Control
                type="number"
                min="1"
                value={linkForm.max_uses}
                onChange={(e) => setLinkForm({...linkForm, max_uses: e.target.value})}
                placeholder="Illimité"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateLinkModal(false)}>
            Annuler
          </Button>
          <Button className="btn-clean-primary" onClick={handleCreateAccessLink}>
            Créer le lien
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Invite User Modal */}
      <Modal show={showInviteModal} onHide={() => setShowInviteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Inviter un utilisateur</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Adresse email *</Form.Label>
              <Form.Control
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                placeholder="email@exemple.com"
                required
              />
              <Form.Text className="text-muted">
                Un email d'invitation sera envoyé à cette adresse
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
            Annuler
          </Button>
          <Button className="btn-clean-primary" onClick={handleInviteUser}>
            Envoyer l'invitation
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Grant Permission Modal */}
      <Modal show={showGrantPermissionModal} onHide={() => setShowGrantPermissionModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Accorder une Permission</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Email de l'utilisateur *</Form.Label>
              <Form.Control
                type="email"
                value={permissionForm.user_email}
                onChange={(e) => setPermissionForm({...permissionForm, user_email: e.target.value})}
                placeholder="email@exemple.com"
                required
              />
              <Form.Text className="text-muted">
                L'utilisateur doit déjà avoir un compte sur la plateforme
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Type de permission *</Form.Label>
              <Form.Select
                value={permissionForm.permission_type}
                onChange={(e) => setPermissionForm({...permissionForm, permission_type: e.target.value as 'view' | 'download' | 'manage'})}
                required
              >
                <option value="view">👁️ View - Peut voir l'album et les photos</option>
                <option value="download">📥 Download - Peut voir et télécharger</option>
                <option value="manage">⚙️ Manage - Peut tout faire (sauf supprimer l'album)</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Date d'expiration (optionnelle)</Form.Label>
              <Form.Control
                type="datetime-local"
                value={permissionForm.expires_at}
                onChange={(e) => setPermissionForm({...permissionForm, expires_at: e.target.value})}
              />
              <Form.Text className="text-muted">
                Laissez vide pour une permission permanente
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowGrantPermissionModal(false)}>
            Annuler
          </Button>
          <Button className="btn-clean-primary" onClick={handleGrantPermission}>
            Accorder la Permission
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Invite with Permission Modal */}
      <Modal show={showInviteWithPermissionModal} onHide={() => setShowInviteWithPermissionModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Inviter un Utilisateur avec Permission</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Adresse email *</Form.Label>
              <Form.Control
                type="email"
                value={invitePermissionForm.email}
                onChange={(e) => setInvitePermissionForm({...invitePermissionForm, email: e.target.value})}
                placeholder="email@exemple.com"
                required
              />
              <Form.Text className="text-muted">
                Un compte sera créé automatiquement si nécessaire
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Type de permission *</Form.Label>
              <Form.Select
                value={invitePermissionForm.permission_type}
                onChange={(e) => setInvitePermissionForm({...invitePermissionForm, permission_type: e.target.value as 'view' | 'download' | 'manage'})}
                required
              >
                <option value="view">👁️ View - Peut voir l'album et les photos</option>
                <option value="download">📥 Download - Peut voir et télécharger</option>
                <option value="manage">⚙️ Manage - Peut tout faire (sauf supprimer l'album)</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Date d'expiration (optionnelle)</Form.Label>
              <Form.Control
                type="datetime-local"
                value={invitePermissionForm.expires_at}
                onChange={(e) => setInvitePermissionForm({...invitePermissionForm, expires_at: e.target.value})}
              />
              <Form.Text className="text-muted">
                Laissez vide pour une permission permanente
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowInviteWithPermissionModal(false)}>
            Annuler
          </Button>
          <Button className="btn-clean-primary" onClick={handleInviteWithPermission}>
            Inviter l'Utilisateur
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Permission Modal */}
      <Modal show={showEditPermissionModal} onHide={() => setShowEditPermissionModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Modifier la Permission</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedPermission && (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Utilisateur</Form.Label>
                <Form.Control
                  type="text"
                  value={selectedPermission.user_email || 'Utilisateur inconnu'}
                  readOnly
                  className="bg-light"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Type de permission *</Form.Label>
                <Form.Select
                  value={selectedPermission.permission_type}
                  onChange={(e) => setSelectedPermission({...selectedPermission, permission_type: e.target.value as 'view' | 'download' | 'manage'})}
                  required
                >
                  <option value="view">👁️ View - Peut voir l'album et les photos</option>
                  <option value="download">📥 Download - Peut voir et télécharger</option>
                  <option value="manage">⚙️ Manage - Peut tout faire (sauf supprimer l'album)</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Date d'expiration</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={selectedPermission.expires_at ? new Date(selectedPermission.expires_at).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setSelectedPermission({...selectedPermission, expires_at: e.target.value || undefined})}
                />
                <Form.Text className="text-muted">
                  Laissez vide pour une permission permanente
                </Form.Text>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  label="Permission active"
                  checked={selectedPermission.is_active}
                  onChange={(e) => setSelectedPermission({...selectedPermission, is_active: e.target.checked})}
                />
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditPermissionModal(false)}>
            Annuler
          </Button>
          <Button className="btn-clean-primary" onClick={handleUpdatePermission}>
            Sauvegarder les Modifications
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}