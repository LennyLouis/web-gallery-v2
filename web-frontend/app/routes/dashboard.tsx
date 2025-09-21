import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Navbar, Nav, Dropdown, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '~/contexts/AuthContext';
import { api, type Album } from '~/lib/supabase';
import type { Route } from './+types/dashboard';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Les photos de Lenny - Dashboard' },
    { name: 'description', content: 'Gérez vos albums photo' },
  ];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, session, logout } = useAuth();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Rediriger si non connecté
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Charger les albums
  useEffect(() => {
    if (user && session) {
      loadAlbums();
    }
  }, [user, session]);

  const loadAlbums = async () => {
    if (!session) return;

    try {
      setLoading(true);
      const result = await api.getAlbums();
      setAlbums(result.albums || []);
    } catch (err) {
      setError('Erreur lors du chargement des albums');
      console.error('Load albums error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleAlbumClick = (albumId: string) => {
    navigate(`/album/${albumId}`);
  };

  if (!user) return null;

  return (
    <div className="web-gallery">
      {/* Navigation */}
      <Navbar expand="lg" className="bg-white shadow-sm">
        <Container>
          <Navbar.Brand href="#" className="fw-bold" style={{color: 'var(--bs-primary)'}}>
            📸 Les photos de Lenny
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link href="#dashboard" style={{color: 'var(--bs-primary)'}}>Dashboard</Nav.Link>
              <Nav.Link href="#albums" style={{color: 'var(--bs-primary)'}}>Albums</Nav.Link>
              {user.role === 'admin' && (
                <>
                  <Nav.Link href="#users" style={{color: 'var(--bs-primary)'}}>Users</Nav.Link>
                  <Nav.Link href="#settings" style={{color: 'var(--bs-primary)'}}>Settings</Nav.Link>
                </>
              )}
            </Nav>
            <Nav>
              <Dropdown align="end">
                <Dropdown.Toggle
                  variant="link"
                  className="text-decoration-none border-0 bg-transparent"
                  style={{color: 'var(--bs-primary)'}}
                  id="user-dropdown"
                >
                  {user.name} ▾
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item href="#profile">Profile</Dropdown.Item>
                  <Dropdown.Item href="#account">Account Settings</Dropdown.Item>
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
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h1 className="h2 fw-bold mb-2" style={{color: 'var(--bs-primary)'}}>
                  Bienvenue, {user.name}! 👋
                </h1>
                <p className="text-muted mb-0">
                  {user.role === 'admin' ? 'Gérez vos albums photo' : 'Vos albums photo'}
                </p>
              </div>
              {user.role === 'admin' && (
                <div>
                  <button className="btn-clean-primary me-2">
                    📁 Nouvel Album
                  </button>
                  <button className="btn-outline-clean">
                    ⚙️ Gérer
                  </button>
                </div>
              )}
            </div>
          </Col>
        </Row>

        {/* Albums Grid */}
        <Row>
          <Col>
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" style={{color: 'var(--bs-primary)'}} />
                <p className="mt-3 text-muted">Chargement des albums...</p>
              </div>
            ) : error ? (
              <div className="text-center py-5">
                <div className="fs-1 text-muted mb-3">⚠️</div>
                <h4 className="h5 text-muted mb-2">Erreur</h4>
                <p className="text-muted mb-4">{error}</p>
                <button className="btn-clean-primary" onClick={loadAlbums}>
                  Réessayer
                </button>
              </div>
            ) : albums.length === 0 ? (
              <div className="text-center py-5">
                <div className="fs-1 text-muted mb-3">📁</div>
                <h4 className="h5 text-muted mb-2">Aucun album trouvé</h4>
                <p className="text-muted mb-4">
                  {user.role === 'admin'
                    ? 'Commencez par créer votre premier album photo.'
                    : 'Aucun album ne vous a encore été attribué.'
                  }
                </p>
                {user.role === 'admin' && (
                  <button className="btn-clean-primary">
                    📁 Créer un album
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h3 className="h5 fw-bold mb-0" style={{color: 'var(--bs-primary)'}}>
                    Mes Albums ({albums.length})
                  </h3>
                </div>
                <Row className="g-4">
                  {albums.map((album) => (
                    <Col md={4} key={album.id}>
                      <Card
                        className="card-clean h-100 album-card"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleAlbumClick(album.id)}
                      >
                        <Card.Body className="p-4">
                          <div className="d-flex align-items-center mb-3">
                            <div className="fs-2 me-3">📸</div>
                            <div className="flex-grow-1">
                              <h5 className="card-title mb-1 fw-bold" style={{color: 'var(--bs-primary)'}}>
                                {album.title}
                              </h5>
                              <small className="text-muted">
                                {album.photo_count || 0} photo{(album.photo_count || 0) > 1 ? 's' : ''}
                              </small>
                            </div>
                          </div>

                          {album.description && (
                            <p className="card-text text-muted mb-3 small">
                              {album.description.length > 100
                                ? `${album.description.substring(0, 100)}...`
                                : album.description
                              }
                            </p>
                          )}

                          <div className="d-flex flex-wrap gap-2 mb-3">
                            {album.date && (
                              <span className="badge bg-light text-dark">
                                📅 {new Date(album.date).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                            {album.location && (
                              <span className="badge bg-light text-dark">
                                📍 {album.location}
                              </span>
                            )}
                            {album.is_public && (
                              <span className="badge bg-success text-white">
                                🌐 Public
                              </span>
                            )}
                          </div>

                          <div className="d-flex justify-content-between align-items-center">
                            <small className="text-muted">
                              Créé le {new Date(album.created_at).toLocaleDateString('fr-FR')}
                            </small>
                            <div className="btn-clean-primary btn-sm">
                              Voir →
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </>
            )}
          </Col>
        </Row>
      </Container>
    </div>
  );
}