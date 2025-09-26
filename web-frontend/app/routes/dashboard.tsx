import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, Button, Navbar, Nav, Dropdown, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '~/contexts/AuthContext';
import { useAlbums } from '~/hooks/useAlbums';
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
  const { user, session, logout, loading: authLoading, isSessionValid } = useAuth();
  
  // Utiliser notre hook optimisé pour les albums
  const { albums, loading: albumsLoading, error, refetch } = useAlbums(
    session?.access_token, 
    {
      enabled: !!user && !!session && isSessionValid(),
      refetchOnWindowFocus: false,
      staleTime: 10 * 60 * 1000
    }
  );

  // Rediriger si non connecté ou token expiré
  useEffect(() => {
    if (!authLoading && (!user || !isSessionValid())) {
      navigate('/login');
    }
  }, [user, authLoading, isSessionValid, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleAlbumClick = (albumId: string) => {
    navigate(`/album/${albumId}`);
  };

  // Memoize loading state pour éviter re-renders inutiles
  const loading = useMemo(() => {
    const result = authLoading || albumsLoading;
    return result;
  }, [authLoading, albumsLoading]);

  // Ne pas afficher le dashboard si l'auth n'est pas encore chargée
  if (authLoading) {
    return (
      <div className="web-gallery">
        <Container className="py-5">
          <div className="text-center">
            <Spinner animation="border" style={{color: 'var(--bs-primary)'}} />
            <p className="mt-3 text-muted">Chargement de l'authentification...</p>
          </div>
        </Container>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="web-gallery">
      {/* Navigation */}
      <Navbar expand="lg" className="bg-white shadow-sm">
        <Container>
          <Navbar.Brand href="#" className="fw-bold d-flex align-items-center" style={{color: 'var(--bs-primary)'}}>
            <img src="/logo-transparent-256x256.png" alt="Logo" width="32" height="32" className="me-2" />
            Les photos de Lenny
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
                  <button
                    className="btn-clean-primary"
                    onClick={() => navigate('/admin')}
                  >
                    ⚙️ Administration
                  </button>
                </div>
              )}
            </div>
          </Col>
        </Row>

        {/* Albums Grid */}
        <Row>
          <Col>
            {albumsLoading ? (
              <div className="text-center py-5">
                <Spinner animation="border" style={{color: 'var(--bs-primary)'}} />
                <p className="mt-3 text-muted">Chargement des albums...</p>
              </div>
            ) : error ? (
              <div className="text-center py-5">
                <div className="fs-1 text-muted mb-3">⚠️</div>
                <h4 className="h5 text-muted mb-2">Erreur</h4>
                <p className="text-muted mb-4">{error}</p>
                <button className="btn-clean-primary" onClick={refetch}>
                  Réessayer
                </button>
              </div>
            ) : albums.length === 0 ? (
              <div className="text-center py-5">
                <div className="fs-1 text-muted mb-3">📁</div>
                <h4 className="h5 text-muted mb-2">Aucun album trouvé</h4>
                <p className="text-muted mb-4">
                  {user.role === 'admin'
                    ? 'Aucun album créé pour le moment. Utilisez l\'administration pour en créer.'
                    : 'Aucun album ne vous a encore été attribué.'
                  }
                </p>
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
                        {/* Album Cover Image */}
                        <div className="position-relative" style={{ height: '200px', overflow: 'hidden' }}>
                          {album.cover_photo_url ? (
                            <Card.Img
                              variant="top"
                              src={album.cover_photo_url}
                              alt={album.title}
                              style={{
                                height: '200px',
                                objectFit: 'cover',
                                width: '100%'
                              }}
                            />
                          ) : (
                            <div className="d-flex align-items-center justify-content-center h-100 bg-light">
                              <div className="text-center text-muted">
                                <div className="fs-1">📸</div>
                                <small>Aucune photo</small>
                              </div>
                            </div>
                          )}
                          {/* Photo count overlay */}
                          <div className="position-absolute top-0 end-0 m-2">
                            <span className="badge bg-dark bg-opacity-75 text-white">
                              {album.photo_count || 0} photo{(album.photo_count || 0) > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        <Card.Body className="p-3">
                          <div className="mb-2">
                            <h5 className="card-title mb-1 fw-bold" style={{color: 'var(--bs-primary)'}}>
                              {album.title}
                            </h5>
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